import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { UpdateCustomerProfileSchema } from './customers.schemas';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';

@Controller('v1/customers/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class CustomerProfileController {
  constructor(private readonly customersService: CustomersService) {}

  @Patch()
  async update(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = UpdateCustomerProfileSchema.parse(body);
    return this.customersService.updateProfile(req.user.sub, parsed);
  }
}
