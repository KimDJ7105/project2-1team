import axios from "axios";

export const getProfile = async (userId: number) => {
  const response = await axios.get(
    "http://localhost:8080/api/profile",
    {
      params: {
        userId,
      },
    }
  );

  return response.data;
};