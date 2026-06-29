import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function dump() {
  const students = await getDocs(collection(db, 'students'));
  console.log('Students:', students.docs.map(d => d.data()));
  const records = await getDocs(collection(db, 'attendance_records'));
  console.log('Records:', records.docs.map(d => d.data()));
  process.exit(0);
}
dump();
