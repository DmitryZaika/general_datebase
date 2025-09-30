ALTER TABLE checklists ADD COLUMN company_id INT NULL;

ALTER TABLE checklists ADD CONSTRAINT fk_checklists_company
    FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;