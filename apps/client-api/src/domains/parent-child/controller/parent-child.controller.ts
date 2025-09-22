import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Req,
  Param,
} from '@nestjs/common';
import { ParentChildService } from '../service/parent-child.service';

@Controller('/private/v1/parent-child')
export class ParentChildController {
  constructor(private readonly parentChildService: ParentChildService) {}

  @Post('link')
  async linkParentToChild(@Req() req, @Body() body: { childId: string }) {
    const parentId = req.user.id;
    return this.parentChildService.linkParentToChild(parentId, body.childId);
  }

  @Delete('unlink/:childId')
  async unlinkParentFromChild(@Req() req, @Param('childId') childId: string) {
    const parentId = req.user.id;
    return this.parentChildService.unlinkParentFromChild(parentId, childId);
  }

  @Get('children')
  async getChildrenOfParent(@Req() req) {
    const parentId = req.user.id;
    return this.parentChildService.getChildrenOfParent(parentId);
  }

  @Get('parents/:childId')
  async getParentsOfChild(@Param('childId') childId: string) {
    return this.parentChildService.getParentsOfChild(childId);
  }
}
