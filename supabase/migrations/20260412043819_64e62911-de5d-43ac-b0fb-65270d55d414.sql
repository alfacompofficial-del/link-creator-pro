
-- Lobbies table
CREATE TABLE public.lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  language text NOT NULL DEFAULT 'html',
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_lobbies_code ON public.lobbies(code);

ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active lobbies" ON public.lobbies FOR SELECT USING (true);
CREATE POLICY "Teachers can create lobbies" ON public.lobbies FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own lobbies" ON public.lobbies FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own lobbies" ON public.lobbies FOR DELETE USING (auth.uid() = teacher_id);

-- Lobby participants
CREATE TABLE public.lobby_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  student_code text NOT NULL DEFAULT '',
  is_online boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, user_id)
);

ALTER TABLE public.lobby_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view participants" ON public.lobby_participants FOR SELECT USING (true);
CREATE POLICY "Users can join lobbies" ON public.lobby_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participation" ON public.lobby_participants FOR UPDATE USING (auth.uid() = user_id);
-- Teachers can also update participant code
CREATE POLICY "Teachers can update participants" ON public.lobby_participants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.lobbies WHERE id = lobby_id AND teacher_id = auth.uid())
);
CREATE POLICY "Users can leave lobbies" ON public.lobby_participants FOR DELETE USING (auth.uid() = user_id);

-- Grades
CREATE TABLE public.lobby_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  grade integer NOT NULL CHECK (grade >= 2 AND grade <= 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, student_id)
);

ALTER TABLE public.lobby_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage grades" ON public.lobby_grades FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Students can view own grades" ON public.lobby_grades FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Anyone in lobby can view grades" ON public.lobby_grades FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lobby_participants WHERE lobby_id = lobby_grades.lobby_id AND user_id = auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_grades;

-- Triggers for updated_at
CREATE TRIGGER update_lobbies_updated_at BEFORE UPDATE ON public.lobbies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lobby_participants_updated_at BEFORE UPDATE ON public.lobby_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lobby_grades_updated_at BEFORE UPDATE ON public.lobby_grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
