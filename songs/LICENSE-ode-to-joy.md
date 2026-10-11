# Ode to Joy: source and license

`songs/ode-to-joy.json` is adapted from Mutopia Project piece 528.

- Piece page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528
- File: https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.ly (LilyPond, 2907 bytes)
- Mutopia id: Mutopia-2009/08/05-528 (last updated 2009/Aug/05)
- Composer: L. V. Beethoven (1770 to 1827). Typeset in LilyPond by Peter Chubb.
- License: Public Domain. The file's own footer says the sheet music "has been placed in the public domain by the typesetter" and points to http://creativecommons.org/licenses/publicdomain . No attribution is required; it is given here anyway so the source can be checked.
- SHA-256 of the exact file read: `a0c865aa9f71221605362622d281405071e0734540e86ce131131757cc803a71`
- Read on: 2026-10-11

## What was taken and what was changed

- Taken: the soprano voice (`sop`) of the file, 16 bars in G major, 4/4, tempo 4=100. Each note was read by a script as a spelled pitch and an onset; the notes the tests compare against are in `tests/fixtures/mutopia-ode-to-joy-onsets.json`.
- Changed: every note was moved down a perfect fifth (G major to C major: four letter names, seven semitones) so the tune sits on the white keys C4 to G4, for a beginner. The beginner level is the only level.
- Not taken: the alto, tenor and bass voices, the text (the file has none) and the engraving. The left hand of this song is an original editorial arrangement of one whole note per bar (C or G), written for this project; it is not from the Mutopia page.

Mutopia's disclaimer applies to the source: the material is provided as-is, with no claim about its accuracy.
