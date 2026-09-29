import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage as msg } from 'nestjs-i18n';
import { DEFAULT_PAGE_LIMIT, IsIntInRange, MAX_PAGE_LIMIT, type PageQuery } from '@turath/common';

const MAX_PAGE = 1_000_000;

/** `?page=&limit=` for any paged list. Both are optional. */
export class PageQueryDto implements PageQuery {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1, example: 1, description: 'Page number, starting at 1.' })
  @IsIntInRange({ min: 1, max: MAX_PAGE, optional: true })
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: DEFAULT_PAGE_LIMIT,
    example: DEFAULT_PAGE_LIMIT,
    description: `Rows per page, up to ${MAX_PAGE_LIMIT}.`,
  })
  @IsIntInRange({ min: 1, max: MAX_PAGE_LIMIT, optional: true })
  limit: number = DEFAULT_PAGE_LIMIT;

  /** The language switch (`?lang=ar`) is read by the i18n resolver; it only has to pass the strict query check. */
  @ApiHideProperty()
  @IsOptional()
  @IsString({ message: msg('validation.STRING') })
  lang?: string;
}
