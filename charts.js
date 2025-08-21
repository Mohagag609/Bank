let yearlyDoughnutChart=null;
export function renderYearlyDoughnut(ctx,labels,values){if(typeof Chart==='undefined'||!ctx)return;if(yearlyDoughnutChart)yearlyDoughnutChart.destroy();yearlyDoughnutChart=new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:['#2563eb','#16a34a','#eab308','#ef4444','#8b5cf6','#06b6d4','#f97316','#22c55e']}]},options:{plugins:{legend:{position:'bottom'}}}})}

