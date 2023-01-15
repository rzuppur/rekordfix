import {parseString} from "xml2js";

export async function parseXML<T>(contents: string): Promise<T> {
  return new Promise((resolve, reject) => {
    parseString(contents, (err: Error | null, result?: T) => {
      if (!err && result) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}
