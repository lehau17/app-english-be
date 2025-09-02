import { Transform } from 'stream';

export function generateClassCode(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function getCsvTransformStream() {
  let headerWritten = false;
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      let output = '';
      if (!headerWritten) {
        output += 'id,name,teacher,students\n';
        headerWritten = true;
      }
      const teacherName = chunk.teacher
        ? `${chunk.teacher.firstName} ${chunk.teacher.lastName}`
        : '';
      const studentCount = chunk.students ? chunk.students.length : 0;
      const row = `"${chunk.id}","${chunk.name}","${teacherName}","${studentCount}"\n`;
      output += row;

      callback(null, output);
    },
  });
}
