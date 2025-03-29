import { useState, useRef, useEffect } from "react";
import { Stone } from "~/utils/queries";
import { Input } from "~/components/ui/input";
import { FaSearch, FaChevronRight, FaEdit, FaImage } from "react-icons/fa";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

// Виды действий для разных ролей
type UserRole = "employee" | "admin" | "customer";

interface StoneSearchProps {
  stones: Stone[];
  onSelectStone: (stoneId: number) => void;
  userRole: UserRole;
}

// Стили подсветки (встроенные, чтобы не зависеть от внешних CSS файлов)
const highlightStyles = `
  @keyframes pulse-highlight {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
    70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .stone-highlight {
    animation: pulse-highlight 2s ease-in-out;
    outline: 2px solid #3b82f6;
    position: relative;
    z-index: 10;
  }
`;

export function StoneSearch({ stones, onSelectStone, userRole }: StoneSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<Stone[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (userRole === "admin") {
      const styleElement = document.createElement('style');
      styleElement.textContent = highlightStyles;
      document.head.appendChild(styleElement);
      
      return () => {
        document.head.removeChild(styleElement);
      };
    }
  }, [userRole]);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsInputFocused(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setSearchResults([]);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    
      const matchingStones = stones.filter(stone => 
      stone.name.toLowerCase().includes(term)
    );
    
    const sortedResults = matchingStones.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      const aStartsWithTerm = aName.startsWith(term);
      const bStartsWithTerm = bName.startsWith(term);
      if (aStartsWithTerm && !bStartsWithTerm) return -1;
      if (!aStartsWithTerm && bStartsWithTerm) return 1;
      
      const aHasExactWord = aName.split(' ').some(word => word === term);
      const bHasExactWord = bName.split(' ').some(word => word === term);
      if (aHasExactWord && !bHasExactWord) return -1;
      if (!aHasExactWord && bHasExactWord) return 1;
      
      const aHasWordStartingWithTerm = aName.split(' ').some(word => word.startsWith(term));
      const bHasWordStartingWithTerm = bName.split(' ').some(word => word.startsWith(term));
      if (aHasWordStartingWithTerm && !bHasWordStartingWithTerm) return -1;
      if (!aHasWordStartingWithTerm && bHasWordStartingWithTerm) return 1;
      
      const aTermIndex = aName.indexOf(term);
      const bTermIndex = bName.indexOf(term);
      if (aTermIndex !== bTermIndex) return aTermIndex - bTermIndex;
      
      // В качестве последнего критерия - сортировка по алфавиту
      return aName.localeCompare(bName);
    });
    
    // Ограничиваем до 5 результатов
    setSearchResults(sortedResults.slice(0, 5));
  }, [searchTerm, stones]);
  
  // Обработчик клика по результату поиска
  const handleResultClick = (stoneId: number) => {
    // Для всех ролей - просто вызываем функцию выбора камня
    onSelectStone(stoneId);
    
    setIsInputFocused(false);
    setSearchTerm("");
    
    // Прокрутка и подсветка только для admin (кроме случая с редактированием)
    if (userRole === "admin") {
      const stoneElement = document.getElementById(`stone-${stoneId}`);
      if (stoneElement) {
        stoneElement.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Подсветка элемента
        stoneElement.classList.add("stone-highlight");
        setTimeout(() => {
          stoneElement.classList.remove("stone-highlight");
        }, 2000);
      }
    }
  };
  
  // Обработчик клика по кнопке slabs (для employee)
  const handleSlabsClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие, чтобы не сработал handleResultClick
    navigate(`/employee/stones/slabs/${stoneId}`);
    setIsInputFocused(false);
    setSearchTerm("");
  };
  
  // Обработчик клика по кнопке edit (для admin)
  const handleEditClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие, чтобы не сработал handleResultClick
    navigate(`/admin/stones/edit/${stoneId}`);
    setIsInputFocused(false);
    setSearchTerm("");
  };
  
  return (
    <div ref={searchRef} className="relative w-80 mt-2">
      <div className="relative">
        <Input
          type="text"
          placeholder="Stone Search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          className="pr-10 py-2 rounded-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500">
          <FaSearch />
        </div>
      </div>
      
      {isInputFocused && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white shadow-xl rounded-lg border border-gray-200 max-h-72 overflow-y-auto">
          {searchResults.map(stone => (
            <div
              key={stone.id}
              onClick={() => handleResultClick(stone.id)}
              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-800">{stone.name}</div>
                <div className="text-sm text-gray-500">{stone.type}</div>
              </div>
              
              {/* Различные действия в зависимости от роли */}
              {userRole === "employee" && (
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => handleResultClick(stone.id)}
                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                  >
                    <FaImage className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => handleSlabsClick(stone.id, e)}
                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                  >
                    <FaChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {userRole === "admin" && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={(e) => handleEditClick(stone.id, e)}
                  className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                >
                  <FaEdit className="h-4 w-4" />
                </Button>
              )}
              
              {userRole === "customer" && (
                <FaChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 