declare global {
  type Env = {
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    API_URL: string;
    GA_MEASUREMENT_ID?: string;
  };
}

declare module "react-router" {
  interface Future {
    v8_middleware: true;
  }
}

export {};
