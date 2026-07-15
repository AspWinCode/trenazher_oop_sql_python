import { create } from 'zustand';

export interface CourseSidebarItem {
  kind: 'section' | 'task';
  nodeId: number;
  number: string;
  label: string;
  depth: number;
  taskId?: number;
  nodeTaskId?: number;
  status?: 'not_started' | 'in_progress' | 'completed';
  locked?: boolean;
}

interface CourseLearnStore {
  courseId: number | null;
  courseTitle: string | null;
  coursePrice: number | null;
  sidebarItems: CourseSidebarItem[];
  selectedTaskId: number | null;
  completedCount: number;
  totalCount: number;
  setCourseData: (
    courseId: number,
    title: string,
    items: CourseSidebarItem[],
    completed: number,
    total: number,
    price?: number | null,
  ) => void;
  setSelectedTaskId: (id: number | null) => void;
  clear: () => void;
}

export const useCourseLearnStore = create<CourseLearnStore>((set) => ({
  courseId: null,
  courseTitle: null,
  coursePrice: null,
  sidebarItems: [],
  selectedTaskId: null,
  completedCount: 0,
  totalCount: 0,
  setCourseData: (courseId, courseTitle, sidebarItems, completedCount, totalCount, coursePrice = null) =>
    set({ courseId, courseTitle, sidebarItems, completedCount, totalCount, coursePrice }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  clear: () =>
    set({
      courseId: null,
      courseTitle: null,
      coursePrice: null,
      sidebarItems: [],
      selectedTaskId: null,
      completedCount: 0,
      totalCount: 0,
    }),
}));
