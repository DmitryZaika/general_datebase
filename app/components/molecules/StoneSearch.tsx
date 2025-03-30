import { useState, useRef, useEffect } from "react";
import { Input } from "~/components/ui/input";
import { FaSearch, FaChevronRight, FaEdit, FaImage } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { useQuery } from "@tanstack/react-query";

type UserRole = "employee" | "admin" | "customer";

interface StoneSearchProps {
  onSelectStone: (stoneId: number) => void;
  userRole: UserRole;
}

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

const getStones = async (name: string): Promise<{id: number, name: string}[]> => {
  const response = await fetch(`/api/stones/search?name=${encodeURIComponent(name)}`)
  const data = await response.json()
  return data?.stones || []
};


export function StoneSearch({ onSelectStone, userRole }: StoneSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isLoading} = useQuery({ queryKey: ['stones', 'search', searchTerm], queryFn: () => getStones(searchTerm) })
  
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
  
  console.log({ data})

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
  
  
  const handleResultClick = (stoneId: number) => {
    onSelectStone(stoneId);
    setIsInputFocused(false);
    setSearchTerm("");
    
    if (userRole === "admin") {
      const stoneElement = document.getElementById(`stone-${stoneId}`);
      if (stoneElement) {
        stoneElement.scrollIntoView({ behavior: "smooth", block: "center" });
        
        stoneElement.classList.add("stone-highlight");
        setTimeout(() => {
          stoneElement.classList.remove("stone-highlight");
        }, 2000);
      }
    }
  };
  
  const handleSlabsClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/employee/stones/slabs/${stoneId}${location.search}`);
  };
  
  const handleEditClick = (stoneId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/stones/edit/${stoneId}/information${location.search}`);
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
      
      {isInputFocused && (
        <div className="absolute z-50 w-full mt-2 bg-white shadow-xl rounded-lg border border-gray-200 max-h-72 overflow-y-auto">
          {data?.map(stone => (
            <div
              key={stone.id}
              onClick={() => handleResultClick(stone.id)}
              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none flex justify-between items-center"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-800">{stone.name}</div>
                {/* <div className="text-sm text-gray-500">{stone.type}</div> */}
              </div>
              
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