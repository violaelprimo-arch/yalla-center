import { IDataProvider } from './index';
import { MockDataProvider } from './mock-data';

let instance: IDataProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (instance) return instance;

  // In demo or offline mode, return in-memory MockDataProvider
  instance = new MockDataProvider();
  return instance;
}
