-- Creating the questions table
CREATE TABLE questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    text TEXT NOT NULL,
    instruction_id INT NULL,
    question_type ENUM('MC', 'TF') NOT NULL,
    company_id INT NOT NULL,
    created_by_user_id INT NULL,
    is_visible_to_employees BOOLEAN DEFAULT FALSE, -- Visibility toggle
    is_deleted BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_questions_id FOREIGN KEY (company_id) REFERENCES company(id),
    CONSTRAINT fk_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id), -- ✅ Assuming you have a `users` table
    CONSTRAINT fk_instruction_questions_id FOREIGN KEY (instruction_id) REFERENCES instructions(id) ON DELETE SET NULL
);


-- Creating the answer_choices table
CREATE TABLE answer_choices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT NOT NULL,
    text VARCHAR(255) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE, -- ✅ Added soft delete support
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_question_answer_choices_id FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
