const express = require("express");
const router = express.Router();
const { GoogleGenAI } = require("@google/genai");
const Room = require("../models/Room");
const { getNearbyRooms } = require("../services/room.service");

// Khởi tạo Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── 1. AI PHÂN TÍCH Ý ĐỊNH + TRÍCH XUẤT TIÊU CHÍ (Structured Output) ──────
/**
 * Gọi Gemini 1 lần duy nhất để:
 * - Phân loại intent (greeting / search / nearby_search / general)
 * - Trích xuất criteria tìm phòng (nếu có)
 * - Trả lời trực tiếp (nếu intent là greeting/general) → Tiết kiệm 1 lần gọi AI
 */
async function analyzeMessageWithAI(message, history = []) {
  const systemPrompt = `Bạn là hệ thống phân tích ý định khách hàng cho website tìm phòng trọ RoomFinder.
Nhiệm vụ: Đọc tin nhắn khách và trả về JSON đúng cấu trúc bên dưới. KHÔNG trả về gì khác ngoài JSON.

{
  "intent": "greeting | search | nearby_search | general",
  "criteria": {
    "targetLocation": null,
    "minPrice": null,
    "maxPrice": null,
    "district": null,
    "type": null,
    "minArea": null,
    "rentalMode": null,
    "priceType": null,
    "amenities": []
  },
  "reply": null
}

QUY TẮC PHÂN LOẠI INTENT:
- "greeting": Khách chào hỏi (hello, hi, xin chào, alo...). Trả reply xưng "Em", gọi khách "Anh/Chị", thân thiện, hỏi khách cần tìm phòng thế nào.
- "search": Khách muốn tìm/thuê phòng với tiêu chí cụ thể (giá, quận, loại phòng, diện tích, loại thuê). Trích xuất criteria. reply = null.
- "nearby_search": Khách nói "gần tôi", "gần đây", "quanh đây", "gần vị trí", "chỗ tôi", hoặc tìm gần một địa điểm cụ thể (VD: "gần Đại học Y", "gần bến xe"). Có thể kèm criteria. reply = null.
- "general": Câu hỏi chung, tán gẫu, hỏi về chính sách, hợp đồng, không liên quan tìm phòng cụ thể. Trả reply tự nhiên, xưng "Em", gọi "Anh/Chị".

QUY TẮC TRÍCH XUẤT CRITERIA:
- QUAN TRỌNG VỀ NGỮ CẢNH: Nếu khách hỏi câu nối tiếp (ví dụ: "còn 4 triệu thì sao?", "thêm ban công nhé"), hãy tự động KẾT HỢP tiêu chí mới với các tiêu chí ĐÃ CÓ trong lịch sử trò chuyện (quận, giá, tiện ích...) để trả về bộ tiêu chí đầy đủ nhất.
- Giá đơn vị VNĐ: "5 triệu" = 5000000, "3 triệu rưỡi" = 3500000, "2.5 củ" = 2500000, "500k" = 500000.
- "dưới X triệu" → maxPrice. "trên/hơn X triệu" → minPrice. "khoảng X triệu" → minPrice = (X-0.5)*1000000, maxPrice = (X+0.5)*1000000. "từ X đến Y triệu" → minPrice, maxPrice.
- type chỉ nhận 1 trong: "Studio", "1 phòng ngủ", "Chung cư mini", "Phòng trọ thường". Nếu không rõ → null.
- district: Tên quận/huyện (VD: "Cầu Giấy", "Đống Đa", "Thanh Xuân"...). Nếu khách hỏi nhiều quận, hãy gom lại cách nhau bởi dấu phẩy, ví dụ: "Hà Đông, Thanh Xuân". Nếu khách nói tên đường/trường/khu vực cụ thể, trích xuất quận chứa khu vực đó.
- minArea: Diện tích tối thiểu (m²), VD: "30m2" → 30.
- rentalMode: "short_term" nếu khách nói thuê theo giờ/ngày/tuần/thuê ngắn hạn. "long_term" nếu khách nói thuê dài hạn/thuê tháng. null nếu không đề cập.
- priceType: Chỉ dùng khi rentalMode = "short_term". Giá trị: "hourly" (thuê giờ), "daily" (thuê ngày), "weekly" (thuê tuần), "monthly" (thuê tháng ngắn hạn). null nếu không rõ hoặc long_term.
- amenities: Danh sách các tiện ích khách yêu cầu. Ghi chuẩn các từ khóa sau: "Điều hòa", "Nóng lạnh", "Chỗ để xe", "Wifi" (nếu khách nói internet/mạng), "Ban công", "Máy giặt", "Tủ lạnh", "Bếp", "Thang máy", "Bảo vệ". Trả về mảng array string.
- targetLocation: Tên địa điểm, trường học, bệnh viện, tòa nhà, địa chỉ cụ thể mà khách muốn tìm phòng ở gần. LUÔN LUÔN ghi đầy đủ tên chính thức và thêm ", Hà Nội" ở cuối để tránh nhầm lẫn địa lý (VD: "Đại học Kiến trúc Hà Nội, Hà Nội", "Học viện Công nghệ Bưu chính Viễn thông, Hà Nội", "Ngã tư Sở, Hà Nội", "Bến xe Mỹ Đình, Hà Nội"). null nếu không có.
- Nếu rentalMode = "short_term" và giá được đề cập (VD: "200k/giờ"), áp dụng minPrice/maxPrice cho đơn vị giá tương ứng (priceType).`;

  // Lấy 10 tin nhắn gần nhất từ history để đảm bảo ngữ cảnh cho các câu hỏi nối tiếp
  const recentHistory = history.slice(-10);
  const contents = [];

  for (const h of recentHistory) {
    contents.push({
      role: h.role === "ai" ? "model" : "user",
      parts: [{ text: h.content }],
    });
  }

  contents.push({ role: "user", parts: [{ text: message }] });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI analysis timeout")), 12000)
  );

  const aiPromise = ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.1, // Nhiệt độ rất thấp để JSON chính xác
    },
  });

  const response = await Promise.race([aiPromise, timeoutPromise]);
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Empty AI response");

  const parsed = JSON.parse(text);

  // Validate intent
  const validIntents = ["greeting", "search", "nearby_search", "general"];
  if (!validIntents.includes(parsed.intent)) {
    parsed.intent = "general";
  }

  return parsed;
}

// ─── FALLBACK: Regex-based detection (dùng khi AI lỗi) ──────────────
function fallbackDetectIntent(message) {
  const msg = message.toLowerCase();

  if (/hello|hi|xin chào|chào|alo/.test(msg)) {
    return "greeting";
  }

  if (/gần vị trí của tôi|gần tôi|gần đây|quanh đây|xung quanh đây|chỗ tôi|gần chỗ tôi/.test(msg)) {
    return "nearby_search";
  }

  if (/phòng|thuê|tìm|giá|trọ/.test(msg)) {
    return "search";
  }

  return "general";
}

function fallbackExtractCriteria(message) {
  const msgLower = message.toLowerCase();
  const isAbove = /(trên|hơn|từ|>=)/i.test(msgLower);
  const isBelow = /(dưới|ít hơn|<=)/i.test(msgLower);
  const criteria = { targetLocation: null };

  // Trích xuất mức giá
  const rangeRegex = /(?:từ|khoảng|giữa)?\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ)?\s*(?:đến|-|tới)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ)/i;
  const rangeMatch = msgLower.match(rangeRegex);

  if (rangeMatch) {
    criteria.minPrice = parseFloat(rangeMatch[1].replace(',', '.')) * 1000000;
    criteria.maxPrice = parseFloat(rangeMatch[2].replace(',', '.')) * 1000000;
  } else {
    const priceRegex = /(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ)/i;
    const priceMatch = msgLower.match(priceRegex);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(',', '.')) * 1000000;
      if (isAbove) criteria.minPrice = price;
      else if (isBelow) criteria.maxPrice = price;
      else {
        criteria.minPrice = Math.max(0, price - 500000);
        criteria.maxPrice = price + 500000;
      }
    }
  }

  // Loại phòng
  if (msgLower.includes("studio")) criteria.type = "Studio";
  else if (msgLower.includes("1 ngủ") || msgLower.includes("1 phòng ngủ")) criteria.type = "1 phòng ngủ";
  else if (msgLower.includes("chung cư") || msgLower.includes("ccmn")) criteria.type = "Chung cư mini";
  else if (msgLower.includes("phòng trọ") || msgLower.includes("phòng thường")) criteria.type = "Phòng trọ thường";

  // Quận
  const districts = ["cầu giấy", "đống đa", "thanh xuân", "hai bà trưng", "hoàn kiếm", "ba đình", "tây hồ", "hoàng mai", "long biên", "hà đông", "bắc từ liêm", "nam từ liêm"];
  const foundDistricts = [];
  for (const q of districts) {
    if (msgLower.includes(q)) {
      foundDistricts.push(q);
    }
  }
  if (foundDistricts.length > 0) {
    criteria.district = foundDistricts.join(", ");
  }

  // Tiện ích
  const amenitiesList = [
    { key: "điều hòa", val: "Điều hòa" },
    { key: "máy lạnh", val: "Điều hòa" },
    { key: "nóng lạnh", val: "Nóng lạnh" },
    { key: "chỗ để xe", val: "Chỗ để xe" },
    { key: "bãi đỗ xe", val: "Chỗ để xe" },
    { key: "wifi", val: "Wifi" },
    { key: "internet", val: "Wifi" },
    { key: "mạng", val: "Wifi" },
    { key: "ban công", val: "Ban công" },
    { key: "máy giặt", val: "Máy giặt" },
    { key: "tủ lạnh", val: "Tủ lạnh" },
    { key: "bếp", val: "Bếp" },
    { key: "thang máy", val: "Thang máy" },
    { key: "bảo vệ", val: "Bảo vệ" }
  ];
  const foundAmenities = [];
  for (const item of amenitiesList) {
    if (msgLower.includes(item.key) && !foundAmenities.includes(item.val)) {
      foundAmenities.push(item.val);
    }
  }
  if (foundAmenities.length > 0) {
    criteria.amenities = foundAmenities;
  }

  // Diện tích
  const areaMatch = msgLower.match(/(\d+)\s*m2/);
  if (areaMatch) criteria.minArea = parseInt(areaMatch[1]);

  // Loại hình thuê
  if (/thuê giờ|theo giờ|thuê ngắn hạn/.test(msgLower)) {
    criteria.rentalMode = "short_term";
    criteria.priceType = "hourly";
  } else if (/thuê ngày|theo ngày/.test(msgLower)) {
    criteria.rentalMode = "short_term";
    criteria.priceType = "daily";
  } else if (/thuê tuần|theo tuần/.test(msgLower)) {
    criteria.rentalMode = "short_term";
    criteria.priceType = "weekly";
  }

  return criteria;
}

// ─── 2. TRUY VẤN DB (đã cập nhật hỗ trợ rentalMode + priceType) ─────
function buildQueryFromCriteria(criteria) {
  const query = {};
  let priceField = "price";

  if (criteria.rentalMode === "short_term") {
    query.rentalMode = "short_term";
    switch (criteria.priceType) {
      case "hourly": priceField = "hourlyPrice"; break;
      case "daily": priceField = "dailyPrice"; break;
      case "weekly": priceField = "weeklyPrice"; break;
      case "monthly": priceField = "monthlyPrice"; break;
      default: priceField = "dailyPrice"; break;
    }
  }

  if (criteria.minPrice && criteria.maxPrice) {
    query[priceField] = { $gte: criteria.minPrice, $lte: criteria.maxPrice };
  } else if (criteria.minPrice) {
    query[priceField] = { $gte: criteria.minPrice };
  } else if (criteria.maxPrice) {
    query[priceField] = { $lte: criteria.maxPrice };
  }

  if (criteria.type) {
    query.type = criteria.type;
  }

  if (criteria.district) {
    const districts = criteria.district.split(/,|\s+và\s+|\s+hoặc\s+/i).map(d => d.trim()).filter(d => d);
    if (districts.length > 1) {
      query.district = { $in: districts.map(d => new RegExp(d, "i")) };
    } else {
      query.district = { $regex: criteria.district, $options: "i" };
    }
  }

  if (criteria.minArea) {
    query.area = { $gte: criteria.minArea };
  }

  if (criteria.amenities && criteria.amenities.length > 0) {
    query.amenities = { $all: criteria.amenities.map(a => new RegExp(a, "i")) };
  }

  return query;
}

async function fetchRoomsFromCriteria(criteria) {
  try {
    const query = buildQueryFromCriteria(criteria);
    query.status = "available";

    const rooms = await Room.find(query)
      .select("name address price area type status images district amenities rentalMode hourlyPrice dailyPrice weeklyPrice monthlyPrice")
      .sort({ price: 1 })
      .lean();

    return rooms;
  } catch (err) {
    console.error("Lỗi tìm phòng:", err);
    return [];
  }
}

// ─── 3. FALLBACK TEXT (không dùng AI) ────────────────────────────────
function generateRawReply(rooms, message) {
  if (!rooms.length) {
    return "Dạ hiện tại chưa có phòng phù hợp với yêu cầu, anh/chị thử điều chỉnh lại tiêu chí giúp em nhé ạ.";
  }

  let text = `Dạ em tìm thấy ${rooms.length} phòng phù hợp:\n\n`;

  rooms.forEach(r => {
    const priceText = r.rentalMode === "short_term"
      ? `${(r.dailyPrice || r.price).toLocaleString()} đ/ngày`
      : `${r.price.toLocaleString()} đ/tháng`;

    text += `🏠 ${r.name}
📍 ${r.address}
💰 ${priceText}
📐 ${r.area || "?"} m²
${r.distance ? `🚶 Cách ${r.distance}m\n` : ""}
`;
  });

  text += "Anh/chị muốn xem chi tiết phòng nào không ạ? 😊";
  return text;
}

// ─── 4. AI SINH CÂU TRẢ LỜI TỰ NHIÊN (Call 2 – chỉ khi có kết quả phòng) ─
async function generateFormattingReply(rooms, message, history = [], extraContext = "") {
  // Tạo bản compact (chỉ lấy tối đa 5 phòng để AI viết lời dẫn, tránh bị timeout do payload quá dài)
  const compactRooms = rooms.slice(0, 5).map(r => {
    const compact = { name: r.name, address: r.address };
    if (r.rentalMode === "short_term") {
      if (r.hourlyPrice) compact.hourlyPrice = r.hourlyPrice;
      if (r.dailyPrice) compact.dailyPrice = r.dailyPrice;
      if (r.weeklyPrice) compact.weeklyPrice = r.weeklyPrice;
      if (r.monthlyPrice) compact.monthlyPrice = r.monthlyPrice;
      compact.rentalMode = "short_term";
    } else {
      compact.price = r.price;
    }
    if (r.area) compact.area = r.area;
    if (r.distance) compact.distance = `${r.distance}m`;
    return compact;
  });

  const systemPrompt = `Bạn là lễ tân tư vấn phòng trọ RoomFinder tên Gemini.
QUY TẮC: Xưng "Em", gọi khách "Anh/Chị". Trả lời NGẮN GỌN (tối đa 4-5 câu lời dẫn).
KHÔNG liệt kê lại chi tiết từng phòng (hệ thống sẽ tự hiển thị card phòng bên dưới). Chỉ cần tóm tắt kết quả: có bao nhiêu phòng, khoảng giá, khu vực, và mời khách xem thêm.
${extraContext}
Dữ liệu phòng: ${JSON.stringify(compactRooms)}`;

  const contents = [
    ...history.slice(-4).map(h => ({
      role: h.role === "ai" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 15000)
  );

  const aiPromise = ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.5,
    },
  });

  const response = await Promise.race([aiPromise, timeoutPromise]);
  return response.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ─── Route POST /api/chat ─────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { message, history = [], userAddress } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Tin nhắn không được để trống." });
    }

    // =====================================================
    // BƯỚC 1: Gọi AI phân tích ý định + trích xuất criteria
    // =====================================================
    let analysis;
    let usedFallback = false;

    try {
      analysis = await analyzeMessageWithAI(message, history);
      console.log("🤖 AI Analysis:", JSON.stringify(analysis));
    } catch (aiErr) {
      console.log("⚠️ AI Analysis failed, dùng fallback regex:", aiErr.message);
      usedFallback = true;

      const intent = fallbackDetectIntent(message);
      const criteria = intent === "search" ? fallbackExtractCriteria(message) : {};

      analysis = {
        intent,
        criteria,
        reply: intent === "greeting"
          ? "Dạ em chào anh/chị 😊 Anh/chị đang cần tìm phòng ở khu vực nào và mức giá khoảng bao nhiêu ạ?"
          : null,
      };
    }

    const { intent, criteria = {}, reply } = analysis;

    // =====================================================
    // BƯỚC 2: Xử lý theo intent
    // =====================================================

    // ─── GREETING / GENERAL: Trả reply ngay (1 lần gọi AI duy nhất) ───
    if (intent === "greeting" || intent === "general") {
      const text = reply || "Dạ em chào anh/chị 😊 Anh/chị cần em hỗ trợ tìm phòng trọ không ạ?";
      return res.json({ text, rooms: [] });
    }

    // ─── TÌM THEO VỊ TRÍ (Khi có targetLocation hoặc intent là nearby_search) ───
    const locationToSearch = criteria?.targetLocation || (intent === "nearby_search" ? userAddress : null);

    if (locationToSearch || intent === "nearby_search") {
      if (!locationToSearch) {
        return res.json({
          text: "Dạ em cần biết vị trí của anh/chị để tìm phòng. Anh/chị vui lòng đăng nhập và cập nhật địa chỉ trong phần Thông tin cá nhân trước nhé, hoặc anh/chị có thể nói tên địa điểm/khu vực cụ thể ạ!",
          rooms: []
        });
      }

      try {
        // 1. Geocoding locationToSearch bằng MapBox API
        const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiYmV0YXBjaG9pMTBrIiwiYSI6ImNrY2ZuaWEwNjA2ZW0yeWw4bG9yNnUyYm0ifQ.bFCQ-5yq6cSsrhugfxO2_Q';

        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationToSearch)}.json`;
        // proximity: ưu tiên kết quả gần trung tâm Hà Nội (lng=105.8342, lat=21.0278)
        const geoRes = await fetch(`${endpoint}?access_token=${MAPBOX_TOKEN}&limit=1&country=vn&language=vi&proximity=105.8342,21.0278`);
        const geoData = await geoRes.json();

        if (geoData.message === "Not Authorized - Invalid Token") {
          return res.json({
            text: "Dạ tính năng bản đồ chưa được cấu hình đúng (Lỗi Token). Anh/chị báo quản trị viên cập nhật MAPBOX_TOKEN nhé!",
            rooms: []
          });
        }

        if (!geoData.features || geoData.features.length === 0) {
          return res.json({
            text: `Dạ em không định vị được địa điểm "${locationToSearch}". Anh/chị có thể cung cấp tên đường/quận cụ thể hơn giúp em được không ạ?`,
            rooms: []
          });
        }

        const [lng, lat] = geoData.features[0].center;
        const placeName = geoData.features[0].place_name || locationToSearch;

        // 2. Tìm phòng gần đó với bộ lọc đầy đủ, nếu không có thì nới lỏng dần
        const extraFilter = buildQueryFromCriteria(criteria || {});
        const radius = 10000; // 10km
        let nearbyResult = await getNearbyRooms(lng, lat, radius, 1, 50, extraFilter);
        let foundRooms = nearbyResult.rooms;
        let relaxedNote = "";

        // Nếu không tìm thấy với đầy đủ tiêu chí → thử bỏ amenities, giữ giá
        if (foundRooms.length === 0) {
          const { amenities, ...filterWithoutAmenities } = extraFilter;
          if (amenities) {
            console.log("🔄 Nới lỏng: bỏ amenities, giữ giá");
            nearbyResult = await getNearbyRooms(lng, lat, radius, 1, 50, filterWithoutAmenities);
            foundRooms = nearbyResult.rooms;
            if (foundRooms.length > 0) {
              relaxedNote = "Lưu ý: Em chưa tìm thấy phòng đáp ứng đủ tất cả tiện ích yêu cầu, nên em gợi ý các phòng gần đó phù hợp nhất về giá.";
            }
          }
        }

        // Vẫn không có → thử chỉ tìm theo vị trí (bỏ hết filter)
        if (foundRooms.length === 0) {
          console.log("🔄 Nới lỏng: chỉ tìm theo vị trí");
          nearbyResult = await getNearbyRooms(lng, lat, radius, 1, 50, {});
          foundRooms = nearbyResult.rooms;
          if (foundRooms.length > 0) {
            relaxedNote = "Lưu ý: Em chưa tìm thấy phòng khớp chính xác tiêu chí về giá và tiện ích, nên em gợi ý các phòng gần khu vực này để anh/chị tham khảo.";
          }
        }

        if (foundRooms.length === 0) {
          return res.json({
            text: `Dạ hiện quanh khu vực "${placeName}" em chưa tìm thấy phòng nào. Anh/chị thử tìm ở khu vực khác xem sao nhé!`,
            rooms: []
          });
        }

        // 3. Gọi AI để viết lời dẫn (Call 2)
        let finalText;
        try {
          finalText = await generateFormattingReply(
            foundRooms,
            message,
            history,
            `Khách muốn tìm phòng gần vị trí: ${placeName}. ${relaxedNote}`
          );
        } catch (err) {
          console.log("Gemini lỗi (nearby formatting):", err.message);
        }

        if (!finalText) {
          finalText = generateRawReply(foundRooms, message);
        }

        return res.json({ text: finalText, rooms: foundRooms });

      } catch (err) {
        console.log("Lỗi tìm phòng gần đây trong chat:", err.message);
        return res.json({
          text: "Dạ hệ thống đang gặp lỗi khi định vị, anh/chị thông cảm thử lại sau giúp em nhé!",
          rooms: []
        });
      }
    }

    // ─── SEARCH: Tìm phòng theo tiêu chí ─────────────────────────────
    if (intent === "search") {
      const foundRooms = await fetchRoomsFromCriteria(criteria);

      if (foundRooms.length === 0) {
        return res.json({
          text: "Dạ hiện chưa có phòng phù hợp với yêu cầu, anh/chị thử thay đổi tiêu chí giúp em nhé ạ.",
          rooms: []
        });
      }

      // Gọi AI để viết lời dẫn (Call 2)
      let finalText;
      try {
        finalText = await generateFormattingReply(foundRooms, message, history);
      } catch (err) {
        console.log("Gemini lỗi (search formatting):", err.message);
      }

      if (!finalText) {
        finalText = generateRawReply(foundRooms, message);
      }

      // Trả TẤT CẢ phòng cho Frontend render
      return res.json({ text: finalText, rooms: foundRooms });
    }

    // ─── Fallback cuối cùng ───────────────────────────────────────────
    return res.json({
      text: reply || "Dạ em chưa hiểu rõ, anh/chị có thể nói cụ thể hơn không ạ?",
      rooms: []
    });

  } catch (err) {
    console.error("Chat route error:", err);
    let errMsg = "AI đang bận vượt tải, đợi em tí rồi thử lại anh/chị nhé!";
    const errText = err?.message || "";
    if (errText.includes("400") || errText.includes("API key not valid")) {
      errMsg = "API Key không hợp lệ. Vui lòng check file .env";
    }
    return res.status(500).json({ message: errMsg });
  }
});

module.exports = router;
