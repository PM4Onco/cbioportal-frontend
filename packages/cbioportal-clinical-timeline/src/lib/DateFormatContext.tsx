import React, { useState, createContext, useContext } from 'react';

// Component that provides the date format determined by state of FormatToggle Button to other components like the Tooltip

// Define the context
interface DateFormatContextType {
    useAbsoluteDateFormat: boolean;
    toggleFormat: () => void;
    startDate: string | null;
}

// Create the context
const DateFormatContext = createContext<DateFormatContextType>({
    useAbsoluteDateFormat: true,
    toggleFormat: () => {},
    startDate: '',
});

// DateFormatProvider to manage the format state
export const DateFormatProvider: React.FC<{
    children: React.ReactNode;
    startDate: string | null;
}> = ({ children, startDate }) => {
    const [showAbsoluteDates, setShowAbsoluteDates] = useState<boolean>(true);

    const toggleDateFormat = () => {
        setShowAbsoluteDates(prev => !prev);
    };

    return (
        <DateFormatContext.Provider
            value={{
                useAbsoluteDateFormat: showAbsoluteDates,
                toggleFormat: toggleDateFormat,
                startDate: startDate,
            }}
        >
            {children}
        </DateFormatContext.Provider>
    );
};

// Custom hook for accessing context
export const useDateFormat = () => {
    const context = useContext(DateFormatContext);
    if (!context) {
        throw new Error(
            'useDateFormat must be used within a DateFormatProvider'
        );
    }
    return context;
};

export default DateFormatContext;
