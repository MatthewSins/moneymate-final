const fs = require('fs');
let content = fs.readFileSync('/app/applet/pages/ExpenseTracker.tsx', 'utf-8');

const dialogCode = `
      <Dialog open={isBudgetSelectOpen} onOpenChange={setIsBudgetSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Budget</DialogTitle>
            <DialogDescription>
              Which budget would you like to assign this transaction to?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Budget</Label>
              <Select value={selectedGlobalBudget} onValueChange={setSelectedGlobalBudget}>
                <SelectTrigger>
                  <SelectValue placeholder="No budget assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No budget assigned</SelectItem>
                  {Array.from(new Set(transactions.filter(t => t.type === 'budget').map(b => b.description).filter(Boolean))).map((b: any) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetSelectOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setIsBudgetSelectOpen(false);
              processSubmit(pendingSubmitData, selectedGlobalBudget);
            }} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
`;

content = content.replace(
  /<Dialog open=\{isBudgetModalOpen\} onOpenChange=\{setIsBudgetModalOpen\}>/,
  dialogCode + '\n      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>'
);

fs.writeFileSync('/app/applet/pages/ExpenseTracker.tsx', content);
