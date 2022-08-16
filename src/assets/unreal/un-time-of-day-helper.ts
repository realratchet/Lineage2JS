const timeOfDay = 12;

function indexToTime(index: number, totalElements: number) {
    return (24.0 / totalElements) * 0.5 + (index * 24.0) / totalElements;
}

export default timeOfDay;
export { timeOfDay, indexToTime };