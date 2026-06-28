import {
  findSubjectProfile,
} from "../utils/appUtils.js";

function SubjectField({ subjects, value, onChange, placeholder = "Subject" }) {
  const matchedSubject = findSubjectProfile(subjects, value);

  if (subjects.length === 0) {
    return (
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <select
      value={value}
      required
      aria-label="Subject"
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" disabled>
        Choose subject
      </option>
      {!matchedSubject && value && <option value={value}>{value}</option>}
      {subjects.map((subject) => (
        <option key={subject.id} value={subject.name}>
          {subject.name}
        </option>
      ))}
    </select>
  );
}

export default SubjectField;
