import {
  EXTRACTION_FIELD_KEYS,
  EXTRACTION_FIELD_LABELS,
} from '@extraction/types';

/**
 * Builds the instruction prompt for a vision model.
 *
 * The image may contain one or multiple handwritten registration records.
 * The model must identify the boundaries of each record and keep fields
 * belonging to the same person together.
 */
export function buildExtractionPrompt(): string {
  const fieldLines = EXTRACTION_FIELD_KEYS.map(
    (key) =>
      `          "${key}": the handwritten "${EXTRACTION_FIELD_LABELS[key]}"`,
  ).join(',\n');

  return `You are a highly accurate OCR engine specialized in reading handwritten registration forms.

The image may contain ONE OR MORE PEOPLE.

Your primary task is to:
1. Read all handwritten text in the image.
2. Identify the boundaries between different people's registration records.
3. Extract the five requested fields for each person.
4. Keep every field attached to the correct person.
5. Preserve the visual order of the people in the image.

TARGET FIELDS:

- Full Name
- Partnership Name
- Email
- Phone Number
- PUK Number

IMPORTANT RECORD-SEPARATION RULES:

- A "record" means one person's complete registration entry or clearly identifiable registration block.
- Do NOT create a new person simply because you encounter a standalone name.
- Do NOT split one person's information into multiple records.
- Do NOT combine information from two different people.
- Fields that appear close together and clearly belong to the same handwritten registration block must stay together.
- Use the visual layout, spacing, labels, lines, rows, and grouping in the image to determine which fields belong together.
- Preserve the order in which complete records appear in the image.
- If a person's record contains some missing fields, keep the person as ONE record and use null for the missing fields.
- Do not create duplicate records.
- Do not invent a person because of an isolated name, PIN, bank number, date of birth, or other unrelated text.
- If text such as "Bank", "PIN", "DOB", "Date of Birth", or other fields appears in the image but is not one of the five target fields, ignore it when constructing the structured fields.
- However, include such readable text in "rawText".

FIELD EXTRACTION RULES:

- Transcribe exactly what is written.
- Do not correct spelling.
- Do not silently fix handwriting.
- Do not normalize names.
- Do not change phone numbers.
- Do not change email addresses.
- Do not change PUK numbers.
- Do not guess missing characters.
- Do not use outside knowledge to complete a value.
- If a target field is clearly absent, return null.
- If a target field is present but genuinely illegible, return null.
- Never copy a value from another person's record.

MULTI-PERSON EXAMPLE:

If the image contains:

Person A:
Full Name: John Doe
Partnership Name: John123
Email: john@example.com
Phone Number: 08012345678
PUK Number: 1234567890

Person B:
Full Name: Jane Doe
Partnership Name: Jane456
Email: jane@example.com
Phone Number: 08098765432
PUK Number: 0987654321

You must return TWO records, not one.

If a person's record has only some of the target fields:

Person C:
Full Name: Michael Doe
Email: michael@example.com

Return ONE record for Person C:

{
  "fullName": "Michael Doe",
  "userName": null,
  "email": "michael@example.com",
  "phoneNumber": null,
  "pukNumber": null
}

DO NOT turn an isolated name into a new record unless the visual evidence indicates that it is actually the beginning of a distinct person's registration block.

RETURN EXACTLY THIS JSON SHAPE:

{
  "records": [
    {
      "fields": {
${fieldLines}
      },
      "fieldConfidences": {
        "fullName": number,
        "userName": number,
        "email": number,
        "phoneNumber": number,
        "pukNumber": number
      },
      "overallConfidence": number
    }
  ],
  "rawText": "all readable text from the image"
}

CONFIDENCE RULES:

- Each field confidence must be a number from 0 to 1.
- Give high confidence only when the handwriting is clearly readable.
- Give lower confidence when handwriting is ambiguous.
- Use 0 confidence for a missing or illegible field.
- overallConfidence must represent the confidence in the complete person's record.
- Do not use confidence values to invent or compensate for missing information.

RAW TEXT RULES:

- "rawText" must contain all text you can actually read from the image.
- Preserve the text as faithfully as possible.
- Do not omit readable text merely because it is not one of the five target fields.
- Do not invent text.

FINAL RULES:

- Respond with JSON only.
- No markdown.
- No code fences.
- No explanations.
- No commentary.
- "records" must always be an array.
- Return one record for each clearly identifiable person's registration block.
- Keep records in visual order.
- Never merge or cross-contaminate fields between people.
- Never invent missing values.

Return valid JSON only.`;
}