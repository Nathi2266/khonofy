import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const USERS = [
  { fullName: 'Grace Mabena', email: 'grace.mabena@khonofy.local', department: 'Administration', designation: 'Office Manager' },
  { fullName: 'Ethan Pillay', email: 'ethan.pillay@khonofy.local', department: 'Administration', designation: 'Facilities Coordinator' },
  { fullName: 'Nomsa Dube', email: 'nomsa.dube@khonofy.local', department: 'Compliance', designation: 'Compliance Manager' },
  { fullName: 'Luke Ferreira', email: 'luke.ferreira@khonofy.local', department: 'Compliance', designation: 'Risk Analyst' },
  { fullName: 'Keabetswe Motsepe', email: 'keabetswe.motsepe@khonofy.local', department: 'Compliance', designation: 'Audit Specialist' },
  { fullName: 'Sophie Anderson', email: 'sophie.anderson@khonofy.local', department: 'Customer Success', designation: 'Customer Success Lead' },
  { fullName: 'Vusi Mthembu', email: 'vusi.mthembu@khonofy.local', department: 'Customer Success', designation: 'Client Onboarding Specialist' },
  { fullName: 'Isabella Rossi', email: 'isabella.rossi@khonofy.local', department: 'Customer Success', designation: 'Account Manager' },
  { fullName: 'Tebogo Maseko', email: 'tebogo.maseko@khonofy.local', department: 'Data Science', designation: 'Lead Data Scientist' },
  { fullName: 'Ryan Mitchell', email: 'ryan.mitchell@khonofy.local', department: 'Data Science', designation: 'Machine Learning Engineer' },
  { fullName: 'Palesa Khoza', email: 'palesa.khoza@khonofy.local', department: 'Data Science', designation: 'BI Developer' },
  { fullName: 'Andrew Thompson', email: 'andrew.thompson@khonofy.local', department: 'Infrastructure', designation: 'Infrastructure Architect' },
  { fullName: 'Dineo Baloyi', email: 'dineo.baloyi@khonofy.local', department: 'Infrastructure', designation: 'Cloud Engineer' },
  { fullName: 'Matthew Jones', email: 'matthew.jones@khonofy.local', department: 'Infrastructure', designation: 'Site Reliability Engineer' },
  { fullName: 'Yolanda Petersen', email: 'yolanda.petersen@khonofy.local', department: 'Logistics', designation: 'Logistics Manager' },
  { fullName: 'Sanele Nkomo', email: 'sanele.nkomo@khonofy.local', department: 'Logistics', designation: 'Supply Chain Coordinator' },
  { fullName: 'Charlotte Meyer', email: 'charlotte.meyer@khonofy.local', department: 'Training', designation: 'Learning & Development Lead' },
  { fullName: 'Musa Khumalo', email: 'musa.khumalo@khonofy.local', department: 'Training', designation: 'Training Facilitator' },
  { fullName: 'Jessica Brown', email: 'jessica.brown@khonofy.local', department: 'Vendor Relations', designation: 'Vendor Relations Manager' },
  { fullName: 'Andile Xaba', email: 'andile.xaba@khonofy.local', department: 'Vendor Relations', designation: 'Partner Success Specialist' },
];

const HEADERS = ['Full Name', 'Email', 'Department', 'Designation'];

function headerCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    width: { size: 25, type: WidthType.PERCENTAGE },
  });
}

function bodyCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text })] })],
    width: { size: 25, type: WidthType.PERCENTAGE },
  });
}

function createUsersDocument() {
  const generatedOn = new Date().toLocaleDateString('en-ZA', { dateStyle: 'long' });

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Khonofy User Directory',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Full names, email addresses, departments, and designations',
                color: '555555',
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Generated: ${generatedOn}`, italics: true, color: '666666' })],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: HEADERS.map((header) => headerCell(header)),
              }),
              ...USERS.map(
                (user) =>
                  new TableRow({
                    children: [
                      bodyCell(user.fullName),
                      bodyCell(user.email),
                      bodyCell(user.department),
                      bodyCell(user.designation),
                    ],
                  }),
              ),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: `Total users: ${USERS.length}`, color: '666666' })],
          }),
        ],
      },
    ],
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'docs');
const outputPath = join(outputDir, 'khonofy-users-list.docx');

mkdirSync(outputDir, { recursive: true });

const buffer = await Packer.toBuffer(createUsersDocument());
writeFileSync(outputPath, buffer);

console.log(`Created ${outputPath} (${USERS.length} users)`);
