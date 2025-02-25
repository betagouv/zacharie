import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';

export class DocumentGenerator {
  private templatePath: string;

  constructor(templatePath: string) {
    this.templatePath = templatePath;
  }

  async generateDocument(replacements: Record<string, string>): Promise<Buffer> {
    const content = await fs.readFile(this.templatePath);
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Replace placeholders
    doc.render(replacements);

    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return buffer;
  }
}
