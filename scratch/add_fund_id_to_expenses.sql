-- Add fund_id column to expenses table referencing company_funds
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES company_funds(id) ON DELETE SET NULL;
