export type BookState = 'playing' | 'paused' | 'fresh' | 'done';

export type Book = {
  id: string;
  title: string;
  author: string;
  pages: number;
  page: number;
  cover: number;
  opened: string;
  progress: number;
  eta: string;
  state: BookState;
};
