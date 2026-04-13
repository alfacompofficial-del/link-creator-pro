-- Create lobbies table
CREATE TABLE public.lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE, -- e.g. PYT-7K
  language TEXT NOT NULL, -- e.g. HTML/CSS/JS, Python
  status TEXT NOT NULL DEFAULT 'active', -- active, closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create lobby members (students) table
CREATE TABLE public.lobby_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID REFERENCES public.lobbies(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL, -- the student's project for this lobby
  grade INTEGER DEFAULT NULL, -- 2, 3, 4, 5
  teacher_comment TEXT DEFAULT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, student_id)
);

-- Enable RLS
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_members ENABLE ROW LEVEL SECURITY;

-- Policies for lobbies
-- Teachers can view their own lobbies
CREATE POLICY "Teachers can view own lobbies" ON public.lobbies
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Students can view lobbies they join (by knowing the code, handled by edge function mostly, but we allow select on active lobbies)
CREATE POLICY "Anyone can view active lobbies by code" ON public.lobbies
  FOR SELECT TO authenticated
  USING (status = 'active');

-- Teachers can insert lobbies
CREATE POLICY "Teachers can insert lobbies" ON public.lobbies
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- Policies for lobby members
-- Students can view their own memberships
CREATE POLICY "Students can view own lobby memberships" ON public.lobby_members
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Teachers can view memberships for their lobbies
CREATE POLICY "Teachers can view members of their lobbies" ON public.lobby_members
  FOR SELECT TO authenticated
  USING (lobby_id IN (SELECT id FROM public.lobbies WHERE teacher_id = auth.uid()));

-- Students can join a lobby
CREATE POLICY "Students can join a lobby" ON public.lobby_members
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Teachers can grade (update) their lobby members
CREATE POLICY "Teachers can grade lobby members" ON public.lobby_members
  FOR UPDATE TO authenticated
  USING (lobby_id IN (SELECT id FROM public.lobbies WHERE teacher_id = auth.uid()));

-- Update updated_at trigger for lobbies
CREATE TRIGGER update_lobbies_updated_at
  BEFORE UPDATE ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
