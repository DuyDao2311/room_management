import api from "./axios";

export interface CreateIncidentPayload {
  roomId: string;
  contractId: string;
  category: string;
  priority: string;
  description: string;
  contactPhone: string;
  availableTime: string;
  images?: File[];
  video?: File;
}

export interface IncidentTimelineEntry {
  _id: string;
  status: string;
  note: string;
  createdBy: {
    _id: string;
    name: string;
    role: string;
    avatar: string;
  };
  createdAt: string;
}

export interface Incident {
  _id: string;
  ticketCode: string;
  room: {
    _id: string;
    name: string;
    roomNumber: string;
    district: string;
  };
  contract: {
    _id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  tenant: {
    _id: string;
    name: string;
    phone: string;
    email: string;
  } | string;
  assignedStaff: {
    _id: string;
    name: string;
    phone: string;
    email: string;
    avatar: string;
  } | null;
  district: string;
  category: string;
  priority: string;
  description: string;
  contactPhone: string;
  availableTime: string;
  images: string[];
  videos: string[];
  status: "pending" | "assigned" | "in_progress" | "resolved" | "closed" | "rejected";
  resolutionNote?: string;
  repairCost?: number;
  afterImages?: string[];
  rating?: number;
  ratingComment?: string;
  ratedAt?: string;
  monthsRented?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentResponse {
  incidents: Incident[];
  totalPages: number;
  currentPage: number;
  totalIncidents: number;
}

export interface IncidentStats {
  total: number;
  inProgress: number;
  completed: number;
  totalCost: number;
}

export const createIncident = async (payload: CreateIncidentPayload): Promise<Incident> => {
  const formData = new FormData();
  
  formData.append("roomId", payload.roomId);
  formData.append("contractId", payload.contractId);
  formData.append("category", payload.category);
  formData.append("priority", payload.priority);
  formData.append("description", payload.description);
  formData.append("contactPhone", payload.contactPhone);
  formData.append("availableTime", payload.availableTime);
  
  if (payload.images && payload.images.length > 0) {
    payload.images.forEach((image) => {
      formData.append("images", image);
    });
  }
  
  if (payload.video) {
    formData.append("videos", payload.video);
  }

  const res = await api.post("/incidents", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  
  return res.data.data;
};

export const getMyIncidents = async (): Promise<Incident[]> => {
  const res = await api.get("/incidents/my");
  return res.data.data;
};

export const getIncidentById = async (id: string): Promise<Incident> => {
  const res = await api.get(`/incidents/${id}`);
  return res.data.data;
};

export const getAllIncidents = async (params?: any): Promise<IncidentResponse> => {
  const res = await api.get("/incidents/all", { params });
  return res.data.data;
};

export const getDistrictIncidents = async (params?: any): Promise<IncidentResponse> => {
  const res = await api.get("/incidents/my-district", { params });
  return res.data.data;
};

export const getIncidentTimeline = async (id: string): Promise<IncidentTimelineEntry[]> => {
  const res = await api.get(`/incidents/${id}/timeline`);
  return res.data.data;
};

export const updateIncidentStatus = async (
  id: string, 
  status: string, 
  note?: string, 
  repairCost?: number, 
  resolutionNote?: string, 
  afterImages?: File[],
  costPayer?: string
): Promise<Incident> => {
  const formData = new FormData();
  formData.append("status", status);
  if (note) formData.append("note", note);
  if (repairCost !== undefined) formData.append("repairCost", repairCost.toString());
  if (resolutionNote) formData.append("resolutionNote", resolutionNote);
  if (costPayer) formData.append("costPayer", costPayer);

  if (afterImages && afterImages.length > 0) {
    afterImages.forEach((image) => {
      formData.append("afterImages", image);
    });
  }

  const res = await api.put(`/incidents/${id}/status`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  
  return res.data.data;
};

export const rateIncident = async (id: string, payload: { rating: number; comment: string }): Promise<Incident> => {
  const res = await api.post(`/incidents/${id}/rate`, payload);
  return res.data.data;
};

export const getIncidentStats = async (): Promise<IncidentStats> => {
  const res = await api.get("/incidents/stats");
  return res.data.data;
};
