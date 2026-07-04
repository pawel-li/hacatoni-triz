import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@nw/shared-types';

@Injectable()
export class AppService {
  getData(): ApiResponse {
    return { message: 'Hello API' };
  }
}
