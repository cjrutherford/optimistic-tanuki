import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';

@Injectable()
export class PermissionsProxyService {
    constructor(
        @Inject(ServiceTokens.PERMISSIONS_SERVICE) private readonly permissionsService: ClientProxy,
    ) {}

    

}
