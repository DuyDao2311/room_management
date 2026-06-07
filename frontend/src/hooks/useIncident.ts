import { useState, useCallback } from "react";
import * as incidentService from "../api/incident.service";
import type { CreateIncidentPayload, Incident } from "../api/incident.service";

export const useIncident = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createIncident = useCallback(async (payload: CreateIncidentPayload): Promise<Incident> => {
    setLoading(true);
    setError(null);
    try {
      const data = await incidentService.createIncident(payload);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Lỗi khi tạo báo cáo sự cố";
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getMyIncidents = useCallback(async (): Promise<Incident[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await incidentService.getMyIncidents();
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Lỗi khi tải danh sách sự cố";
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getIncidentById = useCallback(async (id: string): Promise<Incident> => {
    setLoading(true);
    setError(null);
    try {
      const data = await incidentService.getIncidentById(id);
      return data;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Lỗi khi tải chi tiết sự cố";
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createIncident,
    getMyIncidents,
    getIncidentById,
  };
};
