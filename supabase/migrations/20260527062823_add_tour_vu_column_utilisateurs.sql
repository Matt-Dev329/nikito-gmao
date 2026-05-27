/*
  # Add tour_vu column to utilisateurs

  1. Modified Tables
    - `utilisateurs`
      - `tour_vu` (boolean, default false) - tracks whether the user has seen the guided tour

  2. Notes
    - Once the user completes or skips the tour, this flag is set to true
    - Prevents the tour from showing on every login across devices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'tour_vu'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN tour_vu boolean DEFAULT false;
  END IF;
END $$;