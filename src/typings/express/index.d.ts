
export { };

declare global {
  namespace Express {
    export interface Request {
      // Add necesary types
      user: any
    }
  }
}
