import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mainElement = document.querySelector('main'); // Находим элемент main
    const handleScroll = () => {
      if (!mainElement) return;
      // Используем scrollTop элемента main или pageYOffset окна
      const currentScroll = mainElement.scrollTop || window.pageYOffset;
      if (currentScroll > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Проверяем видимость при монтировании
    handleScroll();

    // Добавляем обработчик на элемент main или window
    const scrollTarget = mainElement || window;
    scrollTarget.addEventListener('scroll', handleScroll);

    // Удаляем обработчик при размонтировании
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    console.log("Кнопка скролла вверх нажата");
    try {
      // Пытаемся прокрутить элемент main плавно
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Если main не найден, пробуем плавно прокрутить window
        window.scrollTo({ 
          top: 0, 
          behavior: 'smooth' 
        });
      }
    } catch (error) {
      console.error("Ошибка при прокрутке:", error);
      // Резервный вариант без плавной прокрутки
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0; 
      } else {
        window.scrollTo(0, 0);
      }
    }
  };

  return isVisible ? (
    <div
      className="fixed bottom-20 right-6 z-[9999] rounded-full w-12 h-12 shadow-lg bg-blue-500 hover:bg-blue-600 flex items-center justify-center cursor-pointer"
      onClick={scrollToTop}
      aria-label="Прокрутка вверх"
    >
      <ChevronUp size={30} className="text-white" />
    </div>
  ) : null;
} 