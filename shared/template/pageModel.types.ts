export interface PageSection {
  sectionKey: string
  fragmentStart: number
  fragmentEnd: number
  isRepeatedHeader: boolean
  isContinued: boolean
}

export interface Page {
  pageNumber: number
  sections: PageSection[]
}

export interface PageModel {
  pages: Page[]
  pageCount: number
}
