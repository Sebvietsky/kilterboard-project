import { JwtPayload } from '../interfaces/jwt-payload.interface';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
