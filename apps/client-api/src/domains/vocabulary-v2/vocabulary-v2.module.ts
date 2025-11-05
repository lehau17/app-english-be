import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { AdminVocabularyController } from './controller/admin-vocabulary.controller';
import { VocabularyListController } from './controller/vocabulary-list.controller';
import { VocabularyReviewController } from './controller/vocabulary-review.controller';
import { VocabularyUnitController } from './controller/vocabulary-unit.controller';
import { VocabularyRepository } from './repository/vocabulary.repository';
import { ReviewService } from './service/review.service';
import { SRSService } from './service/srs.service';
import { VocabularyListService } from './service/vocabulary-list.service';
import { VocabularyTermService } from './service/vocabulary-term.service';
import { VocabularyUnitService } from './service/vocabulary-unit.service';

@Module({
    imports: [NotificationModule], // Import để inject NotificationService
    controllers: [
        VocabularyListController,
        VocabularyUnitController,
        VocabularyReviewController,
        AdminVocabularyController,
    ],
    providers: [
        VocabularyRepository,
        SRSService,
        VocabularyListService,
        VocabularyUnitService,
        VocabularyTermService,
        ReviewService,
    ],
    exports: [
        VocabularyListService,
        VocabularyUnitService,
        VocabularyTermService,
        ReviewService,
    ],
})
export class VocabularyV2Module { }



