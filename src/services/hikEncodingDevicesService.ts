import apiClient from './apiClient';

export type EncodingDevice = {
  id: number;
  name: string;
};

export const getEncodingDevicesBySite = async (
  siteName: string,
): Promise<EncodingDevice[]> => {
  if (!siteName) {
    return [];
  }

  const { data } = await apiClient.get<EncodingDevice[]>(
    '/hik/encoding-devices',
    {
      params: { siteName },
    },
  );

  return Array.isArray(data) ? data : [];
};
