import * as XLSX from 'xlsx';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const USERS = [
  { fullName: 'Swazi Zulu', email: 'swazi.zulu@khonofy.local', department: 'Management', designation: 'Managing Director' },
  { fullName: 'Naledi Mokoena', email: 'naledi.mokoena@khonofy.local', department: 'Management', designation: 'Executive Assistant' },
  { fullName: 'Johan Steyn', email: 'johan.steyn@khonofy.local', department: 'Product', designation: 'Product Owner' },
  { fullName: 'Priya Naidoo', email: 'priya.naidoo@khonofy.local', department: 'Product', designation: 'Product Analyst' },
  { fullName: 'Bongani Cele', email: 'bongani.cele@khonofy.local', department: 'Product', designation: 'Scrum Master' },
  { fullName: 'Hannah Jacobs', email: 'hannah.jacobs@khonofy.local', department: 'Quality Assurance', designation: 'QA Lead' },
  { fullName: 'Themba Shabalala', email: 'themba.shabalala@khonofy.local', department: 'Quality Assurance', designation: 'Test Analyst' },
  { fullName: 'Olivia Pretorius', email: 'olivia.pretorius@khonofy.local', department: 'Quality Assurance', designation: 'Automation Engineer' },
  { fullName: 'Ravi Govender', email: 'ravi.govender@khonofy.local', department: 'IT Support', designation: 'Service Desk Lead' },
  { fullName: 'Chloe Williams', email: 'chloe.williams@khonofy.local', department: 'IT Support', designation: 'Systems Administrator' },
  { fullName: 'Sibusiso Mhlongo', email: 'sibusiso.mhlongo@khonofy.local', department: 'IT Support', designation: 'Network Technician' },
  { fullName: 'Emma van Wyk', email: 'emma.vanwyk@khonofy.local', department: 'Legal', designation: 'Legal Counsel' },
  { fullName: 'Gift Maseko', email: 'gift.maseko@khonofy.local', department: 'Legal', designation: 'Compliance Officer' },
  { fullName: 'Daniel Kruger', email: 'daniel.kruger@khonofy.local', department: 'Procurement', designation: 'Procurement Manager' },
  { fullName: 'Zinhle Buthelezi', email: 'zinhle.buthelezi@khonofy.local', department: 'Procurement', designation: 'Vendor Coordinator' },
  { fullName: 'Michael O\'Connor', email: 'michael.oconnor@khonofy.local', department: 'Research', designation: 'Research Lead' },
  { fullName: 'Aisha Mahomed', email: 'aisha.mahomed@khonofy.local', department: 'Research', designation: 'Market Researcher' },
  { fullName: 'Pieter de Klerk', email: 'pieter.deklerk@khonofy.local', department: 'Strategy', designation: 'Strategy Consultant' },
  { fullName: 'Lindiwe Nkosi', email: 'lindiwe.nkosi@khonofy.local', department: 'Strategy', designation: 'Business Planner' },
  { fullName: 'Connor Adams', email: 'connor.adams@khonofy.local', department: 'Strategy', designation: 'Innovation Analyst' },
];

const HEADERS = ['Full Name', 'Email', 'Department', 'Designation'];

function createUsersWorkbook() {
  const rows = [
    HEADERS,
    ...USERS.map((user) => [user.fullName, user.email, user.department, user.designation]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 36 },
    { wch: 22 },
    { wch: 26 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
  return workbook;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'docs');
const outputPath = join(outputDir, 'khonofy-users-list.xlsx');

mkdirSync(outputDir, { recursive: true });
XLSX.writeFile(createUsersWorkbook(), outputPath);

console.log(`Created ${outputPath} (${USERS.length} users)`);
