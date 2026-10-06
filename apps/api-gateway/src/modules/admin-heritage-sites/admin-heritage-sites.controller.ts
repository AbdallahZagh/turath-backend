import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AdminHeritageSitePatterns,
  HERITAGE_COVER_MAX_BYTES,
  HERITAGE_GALLERY_MAX_BYTES,
  HERITAGE_GALLERY_UPLOAD_MAX_FILES,
  type AdminHeritageSite,
  type AdminHeritageSiteCreatePayload,
  type AdminHeritageSiteDeletePayload,
  type AdminHeritageSiteGetPayload,
  type AdminHeritageSiteListPayload,
  type AdminHeritageSitePage,
  type AdminHeritageSiteUpdatePayload,
  type UploadedImage,
} from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { ImageUploadInterceptor } from '../../core/uploads/image-upload.interceptor.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import {
  CreateHeritageSiteDocs,
  DeleteHeritageSiteDocs,
  GetHeritageSiteDocs,
  ListHeritageSitesDocs,
  UpdateHeritageSiteDocs,
  UploadCoverImageDocs,
  UploadGalleryImagesDocs,
} from './admin-heritage-sites.docs.js';
import {
  CreateHeritageSiteDto,
  ListHeritageSitesQueryDto,
  UpdateHeritageSiteDto,
} from './dto/admin-heritage-site.dto.js';
import { HeritageImagesService } from './heritage-images.service.js';

type UploadedFileData = { buffer: Buffer; size: number };

/**
 * Heritage sites (`/admin/heritage-sites` in the dashboard) behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 * Responses are cached in the identity service, which drops the cache on every write.
 */
@ApiTags('admin-heritage-sites')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/heritage-sites')
export class AdminHeritageSitesController {
  constructor(
    private readonly identity: IdentityClient,
    private readonly images: HeritageImagesService,
  ) {}

  @Get()
  @ListHeritageSitesDocs()
  list(
    @Query() { page, limit, governorate, status, search }: ListHeritageSitesQueryDto,
  ): Promise<AdminHeritageSitePage> {
    return this.identity.send<AdminHeritageSitePage, AdminHeritageSiteListPayload>(AdminHeritageSitePatterns.LIST, {
      page,
      limit,
      governorate,
      status,
      search: search || undefined,
    });
  }

  /** The cover image: exactly one file. */
  @Post('images/cover')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(ImageUploadInterceptor({ field: 'file', maxFiles: 1, maxBytes: HERITAGE_COVER_MAX_BYTES }))
  @UploadCoverImageDocs()
  async uploadCover(@UploadedFile() file: UploadedFileData | undefined): Promise<UploadedImage> {
    const [image] = await this.images.upload('cover', file && [file], HERITAGE_COVER_MAX_BYTES);
    return image;
  }

  /** Gallery photos: a few files at once. */
  @Post('images/gallery')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    ImageUploadInterceptor({
      field: 'files',
      maxFiles: HERITAGE_GALLERY_UPLOAD_MAX_FILES,
      maxBytes: HERITAGE_GALLERY_MAX_BYTES,
    }),
  )
  @UploadGalleryImagesDocs()
  uploadGallery(@UploadedFiles() files: UploadedFileData[] | undefined): Promise<UploadedImage[]> {
    return this.images.upload('gallery', files, HERITAGE_GALLERY_MAX_BYTES);
  }

  @Get(':id')
  @GetHeritageSiteDocs()
  get(@Param('id', ParseIdPipe) id: string): Promise<AdminHeritageSite> {
    return this.identity.send<AdminHeritageSite, AdminHeritageSiteGetPayload>(AdminHeritageSitePatterns.GET, { id });
  }

  @Post()
  @CreateHeritageSiteDocs()
  create(@Body() input: CreateHeritageSiteDto): Promise<AdminHeritageSite> {
    return this.identity.send<AdminHeritageSite, AdminHeritageSiteCreatePayload>(AdminHeritageSitePatterns.CREATE, {
      input,
    });
  }

  @Put(':id')
  @UpdateHeritageSiteDocs()
  update(@Param('id', ParseIdPipe) id: string, @Body() input: UpdateHeritageSiteDto): Promise<AdminHeritageSite> {
    return this.identity.send<AdminHeritageSite, AdminHeritageSiteUpdatePayload>(AdminHeritageSitePatterns.UPDATE, {
      id,
      input,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @DeleteHeritageSiteDocs()
  async delete(@Param('id', ParseIdPipe) id: string): Promise<void> {
    await this.identity.send<{ id: string }, AdminHeritageSiteDeletePayload>(AdminHeritageSitePatterns.DELETE, { id });
  }
}
