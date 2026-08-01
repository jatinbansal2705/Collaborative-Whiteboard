import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BoardAccess } from './board-access.decorator';
import { BoardAccessGuard } from './guards/board-access.guard';
import { BoardsService } from './boards.service';
import type { AddMemberDto } from './dto/add-member.dto';
import type {
  AddMemberResult,
  BoardRosterItem,
  MemberResponseDto,
} from './dto/member-response.dto';
import type {
  BoardDeletedDto,
  BoardDetailDto,
  BoardListResponseDto,
  BoardSummaryDto,
  FavouriteStatusDto,
} from './dto/board-response.dto';
import type { CreateBoardDto } from './dto/create-board.dto';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { ListBoardsQueryDto } from './dto/list-boards-query.dto';
import type { ToggleFavouriteDto } from './dto/toggle-favourite.dto';
import type { UpdateBoardDto } from './dto/update-board.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@ApiTags('boards')
@Controller('boards')
@UseGuards(BoardAccessGuard)
@ApiBearerAuth('access-token')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  @ApiOperation({ summary: 'List boards accessible to the caller' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBoardsQueryDto,
  ): Promise<BoardListResponseDto> {
    return this.boardsService.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a board, optionally from a template' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBoardDto,
  ): Promise<BoardSummaryDto> {
    return this.boardsService.create(user, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List available board templates' })
  listTemplates(): Promise<BoardSummaryDto[]> {
    return this.boardsService.listTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a board template' })
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateDto,
  ): Promise<BoardSummaryDto> {
    return this.boardsService.createTemplate(user, dto);
  }

  @Get(':id')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'Get board details' })
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BoardDetailDto> {
    return this.boardsService.getDetail(user, id);
  }

  @Patch(':id')
  @BoardAccess({ minRole: 'EDITOR' })
  @ApiOperation({ summary: 'Update board metadata' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBoardDto,
  ): Promise<BoardSummaryDto> {
    return this.boardsService.update(user, id, dto);
  }

  @Delete(':id')
  @BoardAccess({ minRole: 'OWNER', ownerOnly: true })
  @ApiOperation({ summary: 'Soft-delete a board' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BoardDeletedDto> {
    return this.boardsService.remove(user, id);
  }

  @Post(':id/duplicate')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'Duplicate a board' })
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BoardSummaryDto> {
    return this.boardsService.duplicate(user, id);
  }

  @Patch(':id/archive')
  @BoardAccess({ minRole: 'EDITOR' })
  @ApiOperation({ summary: 'Archive a board' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BoardSummaryDto> {
    return this.boardsService.archive(user, id);
  }

  @Patch(':id/restore')
  @BoardAccess({ minRole: 'EDITOR' })
  @ApiOperation({ summary: 'Restore an archived board' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BoardSummaryDto> {
    return this.boardsService.restore(user, id);
  }

  @Post(':id/favourite')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'Favourite (or toggle) a board' })
  favourite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ToggleFavouriteDto,
  ): Promise<FavouriteStatusDto> {
    return this.boardsService.setFavourite(user, id, dto.favourite);
  }

  @Delete(':id/favourite')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'Remove a board from favourites' })
  unfavourite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<FavouriteStatusDto> {
    return this.boardsService.setFavourite(user, id, false);
  }

  @Get(':id/members')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'List board members and pending invites' })
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BoardRosterItem[]> {
    return this.boardsService.listMembers(user, id);
  }

  @Post(':id/members')
  @BoardAccess({ minRole: 'EDITOR' })
  @ApiOperation({
    summary: 'Add a member by userId or email (email creates a pending invite)',
  })
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<AddMemberResult> {
    return this.boardsService.addMember(user, id, dto);
  }

  @Patch(':id/members/:userId/role')
  @BoardAccess({ minRole: 'EDITOR' })
  @ApiOperation({ summary: 'Update a member role (OWNER transfers ownership)' })
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
    return this.boardsService.updateMemberRole(user, id, userId, dto.role);
  }

  @Delete(':id/members/me')
  @BoardAccess({ minRole: 'VIEWER' })
  @ApiOperation({ summary: 'Leave a board' })
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.boardsService.removeMember(user, id, user.id);
  }

  @Delete(':id/members/:userId')
  @BoardAccess({ minRole: 'EDITOR' })
  @ApiOperation({ summary: 'Remove a member from a board' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.boardsService.removeMember(user, id, userId);
  }
}
