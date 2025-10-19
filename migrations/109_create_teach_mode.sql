-- Creating the questions table
CREATE TABLE questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    text TEXT NOT NULL,
    instruction_id INT NULL,
    question_type ENUM('MC', 'TF') NOT NULL,
    company_id INT NOT NULL,
    created_by_user_id INT NULL,
    is_visible_to_employees BOOLEAN DEFAULT FALSE, -- Visibility toggle
    deleted_at TIMESTAMP NULL,
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
    deleted_at TIMESTAMP NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_question_answer_choices_id FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);


CREATE TABLE answer_attempts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL, -- Reference to the employee/user
    question_id INT NOT NULL, -- The question being answered
    selected_answer_id INT NULL, -- Reference to the chosen answer_choice
    attempt_number INT NOT NULL DEFAULT 1, -- Starts at 1
    is_correct BOOLEAN NULL, -- Optional: store if the selected answer was correct at the time
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_answer_attempt_employee_id FOREIGN KEY (employee_id) REFERENCES users(id),
    CONSTRAINT fk_answer_attempt_question_id FOREIGN KEY (question_id) REFERENCES questions(id),
    CONSTRAINT fk_answer_attempt_selected_answer_id FOREIGN KEY (selected_answer_id) REFERENCES answer_choices(id)
);
