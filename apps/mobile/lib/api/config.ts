export const config: Config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3000",
};

type Config = {
  API_URL: string;
};
