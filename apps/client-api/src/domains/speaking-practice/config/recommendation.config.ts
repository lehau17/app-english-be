export const recommendationConfig = {
  weights: {
    phonemeMatch: 0.4,
    topicFreshness: 0.3,
    successRateInverse: 0.2,
    srsReviewDue: 0.1,
  },
  freshnessMaxDays: 14,
  minErrorRateForWeakness: 0.3,
  topWeakPhonemesCount: 5,
  defaultRecommendationCount: 5,
};
