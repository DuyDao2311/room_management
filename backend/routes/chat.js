const express = require("express");
const router = express.Router();
const { GoogleGenAI } = require("@google/genai");
const Room = require("../models/Room");
const { getNearbyRooms } = require("../services/room.service");

// Khởi tạo Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
function detectIntent(message) {
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

// ─── 1. LOGIC TRÍCH XUẤT THÔNG TIN (BACKEND XỬ LÝ) ──────────────
function extractSearchCriteria(message) {
  const msgLower = message.toLowerCase();
  const isAbove = /(trên|hơn|từ|>=)/i.test(msgLower);
  const isBelow = /(dưới|ít hơn|<=)/i.test(msgLower);
  const criteria = {};
  

  // a. Trích xuất mức giá + ý nghĩa (trên / dưới / khoảng)
const priceRegex = /(\d+)(?:[.,](\d+))?\s*(triệu|tr|củ)/i;
const priceMatch = msgLower.match(priceRegex);

if (priceMatch) {
  let integerPart = parseInt(priceMatch[1]);
  let decimalPart = priceMatch[2] ? parseInt(priceMatch[2]) : 0;

  if (!priceMatch[0].includes('.') && decimalPart > 0) {
    decimalPart = decimalPart / 10;
  }

  const price = (integerPart + decimalPart) * 1000000;

  // 🎯 detect intent giá
  if (isAbove) {
  criteria.minPrice = price;
} else if (isBelow) {
  criteria.maxPrice = price;
} else {
  // khoảng giá mặc định
  criteria.minPrice = price - 500000;
  criteria.maxPrice = price + 500000;
}
}

  // b. Trích xuất loại phòng
  if (msgLower.includes("studio")) {
    criteria.type = "Studio";
  } else if (msgLower.includes("1 ngủ") || msgLower.includes("1 phòng ngủ") || msgLower.includes("một phòng ngủ")) {
    criteria.type = "1 phòng ngủ";
  } else if (msgLower.includes("chung cư") || msgLower.includes("ccmn")) {
    criteria.type = "Chung cư mini";
  } else if (msgLower.includes("phòng trọ") || msgLower.includes("phòng thường")) {
    criteria.type = "Phòng trọ thường";
  }

  // c. Trích xuất quận/khu vực (Từ khoá cứng phổ biến)
  const districts = ["cầu giấy", "đống đa", "thanh xuân", "hai bà trưng", "hoàn kiếm", "ba đình", "tây hồ", "hoàng mai", "long biên", "hà đông", "bắc từ liêm", "nam từ liêm"];
  for (const q of districts) {
    if (msgLower.includes(q)) {
      criteria.district = q;
      break;
    }
  }
  // d. Diện tích
  const areaMatch = msgLower.match(/(\d+)\s*m2/);
  if (areaMatch) {
    criteria.minArea = parseInt(areaMatch[1]);
  }

  // Nếu không có bất cứ tiêu chí nào nhưng có các từ khóa tìm kiếm chung
  const isSearching = /phòng|tìm|thuê|giá|ở|trọ/i.test(msgLower);
  criteria.isSearching = isSearching || Object.keys(criteria).length > 0;

  return criteria;
}

// ─── 2. LOGIC TÌM KIẾM DB (BACKEND XỬ LÝ) ────────────────────────
async function fetchRoomsFromCriteria(criteria) {
  try {
    const query = { status: "available" };
    
    // if (criteria.maxPrice) {
    //   query.price = { $lte: criteria.maxPrice };
    // }
    if (criteria.minPrice && criteria.maxPrice) {
      query.price = {
        $gte: criteria.minPrice,
        $lte: criteria.maxPrice
      };
    } else if (criteria.minPrice) {
      query.price = { $gte: criteria.minPrice };
    } else if (criteria.maxPrice) {
      query.price = { $lte: criteria.maxPrice };
    }
    
    if (criteria.type) {
      query.type = criteria.type;
    }

    if (criteria.district) {
      // Tìm tương đối với quận
      query.district = { $regex: criteria.district, $options: "i" };
    }
    if (criteria.minArea) {
      query.area = { $gte: criteria.minArea };
    }

    const rooms = await Room.find(query)
      .select("name address price area type status images district amenities")
      .limit(5)
      .sort({ price: 1 })
      .lean();

    return rooms;
  } catch (err) {
    console.error("Lỗi tìm phòng tiết kiệm:", err);
    return [];
  }
}
function generateRawReply(rooms, message) {
  if (!rooms.length) {
    return "Dạ hiện tại chưa có phòng phù hợp với yêu cầu, anh/chị thử điều chỉnh lại tiêu chí giúp em nhé ạ.";
  }

  let text = `Dạ em tìm thấy ${rooms.length} phòng phù hợp với yêu cầu "${message}":\n\n`;

  rooms.forEach(r => {
    text += `🏠 ${r.name}
📍 ${r.address}
💰 ${r.price.toLocaleString()} đ/tháng
📐 ${r.area || "?"} m²
${r.distance ? `🚶 Cách ${r.distance}m\n` : ""}
`;
  });

  text += "Anh/chị muốn xem chi tiết phòng nào không ạ? 😊";

  return text;
}

// ─── Route POST /api/chat ─────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { message, history = [], userAddress } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Tin nhắn không được để trống." });
    }
    // 🔥 Detect intent
const intent = detectIntent(message);

// 👉 BƯỚC 4: GREETING (hello, hi...)
if (intent === "greeting") {
  return res.json({
    text: "Dạ em chào anh/chị 😊 Anh/chị đang cần tìm phòng ở khu vực nào và mức giá khoảng bao nhiêu ạ?",
    rooms: []
  });
}

// 👉 BƯỚC 4.5: NEARBY SEARCH
if (intent === "nearby_search") {
  if (!userAddress) {
    return res.json({
      text: "Dạ em cần biết vị trí của anh/chị để tìm phòng. Anh/chị vui lòng đăng nhập và cập nhật địa chỉ trong phần Thông tin cá nhân trước nhé, hoặc anh/chị có thể nói tên quận cụ thể ạ!",
      rooms: []
    });
  }

  try {
    // 1. Geocoding userAddress bằng MapBox API
    const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiYmV0YXBjaG9pMTBrIiwiYSI6ImNrY2ZuaWEwNjA2ZW0yeWw4bG9yNnUyYm0ifQ.bFCQ-5yq6cSsrhugfxO2_Q';
    
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(userAddress)}.json`;
    const geoRes = await fetch(`${endpoint}?access_token=${MAPBOX_TOKEN}&limit=1`);
    const geoData = await geoRes.json();

    if (geoData.message === "Not Authorized - Invalid Token") {
      return res.json({
        text: "Dạ tính năng bản đồ chưa được cấu hình đúng (Lỗi Token). Anh/chị báo quản trị viên cập nhật MAPBOX_TOKEN nhé!",
        rooms: []
      });
    }

    if (!geoData.features || geoData.features.length === 0) {
      return res.json({
        text: "Dạ em không định vị được địa chỉ trong hồ sơ của anh/chị. Anh/chị kiểm tra lại địa chỉ trong phần Thông tin cá nhân giúp em nhé!",
        rooms: []
      });
    }

    const [lng, lat] = geoData.features[0].center;

    // 2. Lấy danh sách phòng gần đó (5km)
    const nearbyResult = await getNearbyRooms(lng, lat, 5000, 1, 5, {});
    let foundRooms = nearbyResult.rooms;

    if (foundRooms.length === 0) {
      return res.json({
        text: "Dạ hiện quanh khu vực của anh/chị (bán kính 5km) em chưa tìm thấy phòng nào phù hợp. Anh/chị thử tìm ở khu vực khác xem sao nhé!",
        rooms: []
      });
    }

    // 3. Chuẩn bị JSON cho AI
    const compactRooms = foundRooms.map(r => ({
      name: r.name,
      price: r.price,
      address: r.address,
      distance: `${Math.round(r.distance)}m`
    }));

    let dynamicSystemPrompt = `Bạn là nhân viên lễ tân tư vấn phòng trọ của RoomFinder tên là Gemini. 
Nhiệm vụ duy nhất: Thông báo cho khách hàng danh sách các phòng trọ gần vị trí của họ dựa trên dữ liệu.

QUY TẮC CỐT LÕI:
1. Xưng hô "Dạ", "Em", gọi khách là "Anh/Chị".
2. Trả lời cực kỳ NGẮN GỌN (Tối đa 5-6 câu). 
3. Liệt kê rõ khoảng cách (distance), giá tiền và địa chỉ rõ ràng.

======= THÔNG TIN HỆ THỐNG CUNG CẤP =======
- Ý định của khách: Khách muốn tìm phòng gần vị trí của họ (${userAddress}).
- Kết quả Query: ${foundRooms.length} phòng.
- Danh sách phòng JSON: ${JSON.stringify(compactRooms)}
============================================`;

    const contents = [
      ...history.map((h) => ({
        role: h.role === "ai" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    let finalText = "";
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000)
      );

      const aiPromise = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: dynamicSystemPrompt,
          temperature: 0.5,
        },
      });

      const response = await Promise.race([aiPromise, timeoutPromise]);
      finalText = response.candidates?.[0]?.content?.parts?.[0]?.text || generateRawReply(foundRooms, message);
    } catch (aiErr) {
      console.log("Gemini lỗi (nearby_search):", aiErr.message);
      // 🔥 fallback không dùng AI
      finalText = generateRawReply(foundRooms, message);
    }

    return res.json({ text: finalText, rooms: foundRooms });

  } catch (err) {
    console.log("Lỗi tìm phòng gần đây trong chat:", err.message);
    return res.json({
      text: "Dạ hệ thống đang gặp lỗi khi tìm vị trí, anh/chị thông cảm thử lại sau giúp em nhé!",
      rooms: []
    });
  }
}

// 👉 BƯỚC 5: GENERAL (chat bình thường)
if (intent === "general") {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      config: {
        systemInstruction: "Bạn là trợ lý tư vấn phòng trọ thân thiện. Trả lời tự nhiên, không cần dữ liệu phòng.",
        temperature: 0.7
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    return res.json({
      text: text || "Dạ em chưa hiểu rõ, anh/chị có thể nói rõ hơn không ạ?",
      rooms: []
    });

  } catch (err) {
    return res.json({
      text: "Dạ em chưa hiểu rõ câu hỏi, anh/chị có thể nói cụ thể hơn không ạ?",
      rooms: []
    });
  }
}

    // [BƯỚC 1]: Backend nhận diện và bóc tách thông tin tiếng Việt
    // const criteria = extractSearchCriteria(message);
    // const intent = detectIntent(message);
    const criteria = extractSearchCriteria(message);
    
    // [BƯỚC 2]: Truy vấn Database thuần tuý
    let foundRooms = [];
    if (intent === "search") {
      foundRooms = await fetchRoomsFromCriteria(criteria);
      if (foundRooms.length === 0) {
        return res.json({
          text: "Dạ hiện chưa có phòng phù hợp, anh/chị thử thay đổi yêu cầu giúp em nhé ạ.",
          rooms: []
        });
  }
}

    const compactRooms = foundRooms.map(r => ({
      name: r.name,
      price: r.price,
      address: r.address
    }));
    // [BƯỚC 3]: Dùng AI để VĂN PHONG HOÁ (re-write) câu trả lời
    let dynamicSystemPrompt = `Bạn là nhân viên lễ tân tư vấn phòng trọ của RoomFinder tên là Gemini. 
Nhiệm vụ duy nhất của bạn: Chuyển đổi dữ liệu thô (JSON) do hệ thống cung cấp thành lời chào mời nói chuyện thân thiện, tự nhiên.

QUY TẮC CỐT LÕI:
1. KHÔNG tự tư duy suy diễn tìm phòng. Chỉ được phép dựa đúng vào thông số [DỮ LIỆU ĐÃ TRÍCH XUẤT] và số phòng ở [DỮ LIỆU KẾT QUẢ DB] bên dưới.
2. Xưng hô "Dạ", "Em", gọi khách là "Anh/Chị".
3. Trả lời cực kỳ NGẮN GỌN (Tối đa 5-6 câu), vào thẳng vấn đề, không mông lung. Trình bày phòng có xuống dòng rõ ràng, giá tiền và địa chỉ rõ ràng.

======= THÔNG TIN HỆ THỐNG CUNG CẤP =======
- Ý định của khách: Khách nói "${message}"
- Hệ thống đã bóc tách được yêu cầu là: ${JSON.stringify(compactRooms)}
- Kết quả Query trên Database trả ra: ${foundRooms.length} phòng.
- Danh sách phòng JSON: ${JSON.stringify(foundRooms, null, 2)}
============================================`;

    // Chuẩn bị payload cho AI
    const contents = [
      ...history.map((h) => ({
        role: h.role === "ai" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: `Dựa vào dữ liệu từ hệ thống, hãy trả lời cho tôi: ${message}` }] },
    ];

    // // Chỉ gọi AI 1 lần duy nhất để Rewrite
    // const response = await ai.models.generateContent({
    //   model: "gemini-2.5-flash",
    //   contents,
    //   config: {
    //     systemInstruction: dynamicSystemPrompt,
    //     temperature: 0.5, // Dùng nhiệt độ thấp để giảm "bịa đặt", ưu tiên văn phong
    //   },
    // });

    // const finalText = response.candidates?.[0]?.content?.parts?.[0]?.text || "Dạ mạng hơi yếu, anh/chị thao tác lại giúp em nhé.";
    let finalText = "";

try {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 3000)
  );

  // 🤖 gọi AI
  const aiPromise = ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: dynamicSystemPrompt,
      temperature: 0.5,
    },
  });
  const response = await Promise.race([aiPromise, timeoutPromise]);

  finalText =
    response.candidates?.[0]?.content?.parts?.[0]?.text ||
    generateRawReply(foundRooms, message);

} catch (err) {
  console.log("Gemini lỗi:", err.message);

  // 🔥 fallback không dùng AI
  finalText = generateRawReply(foundRooms, message);
}
    
    // Trả cả chữ (cho AI nói) và mảng phòng (về React tự vẽ danh sách hình ảnh Component ra UI)
    return res.json({ text: finalText, rooms: foundRooms });

  } catch (err) {
    let errMsg = "AI đang bận vượt tải, đợi em tí rồi thử lại anh/chị nhé!";
    const errText = err?.message || "";
    if (errText.includes("400") || errText.includes("API key not valid")) {
       errMsg = "API Key không hợp lệ. Vui lòng check file .env";
    }
    return res.status(500).json({ message: errMsg });
  }
});

module.exports = router;
