-- Run after 008. Two more Arena questions about Don Jazzy (they appear at the end of the quiz).
-- Run this once. If you run it twice you will get duplicate questions.
insert into quiz_questions (question, options, answer, why) values
 ('Besides music, Don Jazzy launched which food brand?', array['Jazzy''s Burger','Mavin Suya Spot','Baba J Pizza','Don''s Chicken'], 0, 'Jazzy''s Burger is his food business, known for letting fans order through its app.'),
 ('Which catchphrase is Don Jazzy''s famous producer tag?', array['Mavin all day!','It''s Don Jazzy Again!','Jazzy on the beat!','Baba J is in the building!'], 1, 'He has used "It''s Don Jazzy Again!" as his producer tag since his early production days.');
