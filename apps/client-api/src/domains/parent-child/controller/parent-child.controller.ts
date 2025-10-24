import { PayloadToken, ResponseMessage, Roles, RolesGuard } from '@app/shared';
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreateLinkRequestDto } from '../dto/parent-child.dto';
import { ParentChildService } from '../service/parent-child.service';

@ApiTags('Parent-Child')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/parent-child')
export class ParentChildController {
    constructor(private readonly parentChildService: ParentChildService) { }

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

    // ==================== LINK REQUEST ENDPOINTS ====================

    @Post('request')
    @UseGuards(RolesGuard)
    @Roles(UserRole.parent)
    @ApiOperation({
        summary: 'Parent gửi yêu cầu liên kết với học sinh',
        description: 'Parent có thể gửi yêu cầu liên kết bằng cách nhập email của học sinh',
    })
    @ResponseMessage('Link request created successfully')
    async createLinkRequest(
        @Body() body: CreateLinkRequestDto,
        @PayloadToken('sub') parentId: string,
    ) {
        return this.parentChildService.createLinkRequest(
            parentId,
            body.studentIdentifier,
        );
    }
}
