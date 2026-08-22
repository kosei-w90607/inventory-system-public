export function deriveProposedCost(
  newSellingPrice: number,
  currentCostPrice: number,
  currentSellingPrice: number,
): number {
  return currentSellingPrice === 0
    ? currentCostPrice
    : Math.floor((newSellingPrice * currentCostPrice) / currentSellingPrice);
}

export function formatMarkupRate(costPrice: number, sellingPrice: number): string {
  return sellingPrice === 0 ? "—" : (Math.round((costPrice * 1000) / sellingPrice) / 10).toFixed(1);
}

export function isRevisedToday(changedAt: string | undefined, todayYmd: string): boolean {
  return changedAt?.slice(0, 10) === todayYmd;
}
