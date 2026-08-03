export type PageGeometry = {
  getItemLayout: (data: ArrayLike<unknown> | null | undefined, index: number) => { length: number; offset: number; index: number };
  onPageLayout: (page: number, height: number) => void;
  version: number;
};
