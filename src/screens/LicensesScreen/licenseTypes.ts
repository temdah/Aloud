export type LicenseEntry = {
  name: string;
  license: string;
  note?: string;
};

export type LicenseSection = {
  title: string;
  entries: LicenseEntry[];
};
