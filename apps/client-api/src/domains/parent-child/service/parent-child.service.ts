import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ParentChild } from '@prisma/client';
import {
  CreateParentChildDto,
  FilterParentChildRequestDto,
} from '../dto/parent-child.dto';
import { ParentChildRepository } from '../repository/parent-child.repository';

@Injectable()
export class ParentChildService {
  constructor(private readonly parentChildRepository: ParentChildRepository) {}

  async create(dto: CreateParentChildDto): Promise<ParentChild> {
    return this.parentChildRepository.create(dto);
  }

  async linkParentToChild(parentId: string, childId: string): Promise<ParentChild> {
    // Prevent duplicate link
    const existing = await this.parentChildRepository.findById(parentId, childId);
    if (existing) {
      return existing;
    }
    return this.parentChildRepository.create({ parentId, childId });
  }

  async unlinkParentFromChild(parentId: string, childId: string): Promise<ParentChild> {
    await this.ensureExists(parentId, childId);
    return this.parentChildRepository.delete(parentId, childId);
  }

  async getChildrenOfParent(parentId: string): Promise<ParentChild[]> {
    // List all children for a parent
    return this.parentChildRepository.findManyByParentId(parentId);
  }

  async getParentsOfChild(childId: string): Promise<ParentChild[]> {
    // List all parents for a child
    return this.parentChildRepository.findManyByChildId(childId);
  }

  async findById(parentId: string, childId: string): Promise<ParentChild> {
    const parentChild = await this.parentChildRepository.findById(
      parentId,
      childId,
    );
    if (!parentChild) {
      throw new NotFoundException(
        `ParentChild with parentId ${parentId} and childId ${childId} not found`,
      );
    }
    return parentChild;
  }

  async delete(parentId: string, childId: string): Promise<ParentChild> {
    await this.ensureExists(parentId, childId);
    return this.parentChildRepository.delete(parentId, childId);
  }

  async list(
    params: FilterParentChildRequestDto,
  ): Promise<PageResponseDto<ParentChild>> {
    return this.parentChildRepository.list(params);
  }

  private async ensureExists(parentId: string, childId: string): Promise<void> {
    const exists = await this.parentChildRepository.findById(parentId, childId);
    if (!exists) {
      throw new NotFoundException(
        `ParentChild with parentId ${parentId} and childId ${childId} not found`,
      );
    }
  }
}
