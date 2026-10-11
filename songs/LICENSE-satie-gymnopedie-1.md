# Gymnopédie No. 1: source and license

`songs/satie-gymnopedie-1.json` is adapted from Mutopia Project piece 37.

- Piece page: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37
- Files: https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.ly (LilyPond) and https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.mid (the MIDI file LilyPond makes from it)
- Mutopia id: Mutopia-2014/12/14-37 (last updated 2014/Dec/14)
- Composer: Erik Satie (1866 to 1925), composed in 1888. Typeset in LilyPond 2.18.2 by Evin Robertson from the Dover edition (a reproduction of the original publication; the Dover translations are not in the file).
- License: Public Domain. The file's own footer says the sheet music was "placed in the public domain by the typesetter" and points to http://creativecommons.org/licenses/publicdomain . No attribution is required; it is given here anyway so the source can be checked.
- SHA-256 of the exact files read: `420a52244e9fbe106dd33ba2cac84414fd66e0d01c6d472205bad39678d4ce04` (the .ly) and `09ce7337b4bf42ba12e1aa64b4c7dc7fcfa6455f1070cb12f8880a755df97384` (the .mid)
- Read on: 2026-10-11

## What was taken and what was changed

- Taken: the three voices of the file (the melody, the chords and the bass): 31 bars of body and two endings of 8 bars, in 3/4, with the marking Lent et douloureux. A throwaway program (not kept in this repository) read the pitches, durations and ties, and every onset of its result was checked against the MIDI file; the onsets are in `tests/fixtures/mutopia-satie-gymnopedie1-onsets.json`.
- Changed: the repeat with two endings is written out (78 bars); the left hand and the right hand are assigned by this project (the source has staves, not hands); every finger is editorial (the source prints none); the key is stated as D major; the Beginner level is a simplification made for this project.
- Not taken: the engraving, the Dover translations, any pedal or tempo number (the source has none).

Mutopia's disclaimer applies to the source: the material is provided as-is, with no claim about its accuracy.
