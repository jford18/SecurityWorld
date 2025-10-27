import { HikEvent, HikCamera } from '../types';

const API_BASE = "https://5c0f5392-d084-4e7a-b99e-38e6942a9039.mock.pstmn.io";

// Define response types to match the mock API structure
interface EventResponse {
  data?: {
    list?: HikEvent[];
  };
  msg?: string;
}

interface ControllingResponse {
  data?: {
    processed?: string[];
  };
  msg?: string;
}

interface CameraResponse {
  data?: HikCamera[];
  msg?: string;
}

const handleFetchError = async (response: Response, defaultMessage: string): Promise<never> => {
    let errorMessage = defaultMessage;
    try {
        const errorBody = await response.json();
        if (errorBody && errorBody.msg) {
            errorMessage = errorBody.msg;
        }
    } catch (e) {
        // Body is not JSON or is empty, use the default message.
    }
    throw new Error(errorMessage);
};


export const getEvents = async (): Promise<HikEvent[]> => {
    const body = {
      eventTypes: "131329,131330,131331",
      srcType: "camera",
      startTime: "2025-10-11T07:00:00+00:00",
      endTime: "2025-10-12T07:00:00+00:00",
      pageNo: 1,
      pageSize: 500
    };
    const response = await fetch(`${API_BASE}/api/eventService/v1/eventRecords/page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        return handleFetchError(response, `HTTP error fetching events! status: ${response.status}`);
    }
    const result: EventResponse = await response.json();
    return result.data?.list || [];
};

export const getControlledEvents = async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE}/api/eventService/v1/eventRecords/controlling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        return handleFetchError(response, `HTTP error fetching controlled events! status: ${response.status}`);
    }
    const result: ControllingResponse = await response.json();
    return result.data?.processed || [];
};

export const getCameras = async (): Promise<HikCamera[]> => {
    const response = await fetch(`${API_BASE}/api/resource/v1/cameras/indexCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        return handleFetchError(response, `HTTP error fetching cameras! status: ${response.status}`);
    }
    const result: CameraResponse = await response.json();
    return result.data || [];
};